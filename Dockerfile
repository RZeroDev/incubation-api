# Étape de construction
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .
# Définir une DATABASE_URL factice pour prisma generate (pas besoin d'une vraie connexion)
ENV DATABASE_URL="postgresql://neondb_owner:npg_PMeSr9YvH3cA@ep-dry-sea-a44cjo19-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
RUN npx prisma generate && npm run build

# Étape de production
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Copier les fichiers nécessaires depuis l'étape de build
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
# COPY --from=build /usr/src/app/uploads ./uploads

# Exposer le port
EXPOSE 3000

# Commande de démarrage modifiée pour pointer vers le bon chemin
CMD ["node", "dist/src/main.js"] 