# 🔐 SecureVault API

API bancaire sécurisée pour le stockage et le partage de documents confidentiels (KYC, contrats, etc.)

## 📋 Description

SecureVault est une plateforme robuste et sécurisée conçue pour les institutions financières et bancaires. Elle permet de gérer de manière sécurisée des documents hautement sensibles tout en respectant les normes GDPR et les standards de sécurité bancaire.

### Fonctionnalités principales

- 🔐 Authentification JWT sécurisée
- 📄 Gestion sécurisée des documents
- 👥 Partage de documents avec contrôle d'accès
- 📊 Conformité GDPR
- 🔍 Audit et traçabilité
- 📚 Documentation API complète (Swagger)

## 🚀 Démarrage rapide

### Prérequis

- Node.js (v18 ou supérieur)
- PostgreSQL (v14 ou supérieur)
- npm ou yarn

### Installation

1. **Cloner le projet et installer les dépendances**

```bash
npm install
```

2. **Configurer les variables d'environnement**

Copiez le fichier `.env.example` vers `.env` et configurez les variables :

```bash
cp .env.example .env
```

Éditez le fichier `.env` avec vos configurations :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/securevault?schema=public"
JWT_SECRET="votre-secret-jwt-tres-securise-changez-en-production"
PORT=3000
```

**⚠️ Important pour DATABASE_URL :**
- Si votre mot de passe PostgreSQL contient des caractères spéciaux (comme `@`, `:`, `/`, `%`), vous devez les encoder en URL
- Exemple : si votre mot de passe est `p@ssw0rd`, utilisez `p%40ssw0rd` dans la connection string
- Format complet : `postgresql://[user]:[password]@[host]:[port]/[database]?schema=public`

3. **Générer le client Prisma**

```bash
npm run prisma:generate
```

4. **Créer la base de données et appliquer les migrations**

```bash
npm run prisma:migrate
```

5. **Seeder la base de données avec les comptes initiaux**

```bash
# Option 1 : Utiliser la commande Prisma
npx prisma db seed

# Option 2 : Utiliser le script npm
npm run prisma:seed
```

6. **Démarrer l'application**

```bash
# Mode développement
npm run start:dev

# Mode production
npm run start:prod
```

L'API sera accessible sur `http://localhost:3000`
La documentation Swagger sera disponible sur `http://localhost:3000/api`

## 👤 Comptes par défaut

Après le seeding, les comptes suivants sont disponibles :

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| `admin@securevault.com` | `SecureVault2025!` | ADMIN |
| `officer@securevault.com` | `SecureVault2025!` | BANK_OFFICER |
| `user@securevault.com` | `SecureVault2025!` | USER |

⚠️ **Important** : Changez ces mots de passe en production !

## 📚 Documentation API

Une fois l'application démarrée, accédez à la documentation Swagger interactive :

- **URL** : `http://localhost:3000/api`
- **Authentification** : Utilisez le bouton "Authorize" et entrez votre token JWT après connexion

## 🔑 Authentification

### Endpoint de connexion

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "admin@securevault.com",
  "password": "SecureVault2025!"
}
```

### Réponse

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@securevault.com",
    "firstName": "Admin",
    "lastName": "SecureVault",
    "role": "ADMIN"
  }
}
```

### Utilisation du token

Pour les endpoints protégés, incluez le token dans les headers :

```
Authorization: Bearer <votre-token-jwt>
```

## 🔐 Autorisation et Guards

### Guards JWT

Toutes les routes sont protégées par défaut avec le `JwtAuthGuard`. Pour rendre une route publique, utilisez le décorateur `@Public()` :

```typescript
import { Public } from './auth/decorators';

@Public()
@Get('public-endpoint')
getPublicData() {
  return { message: 'Données publiques' };
}
```

### Guards basés sur les rôles (RBAC)

Utilisez le décorateur `@Roles()` pour restreindre l'accès à certains rôles :

```typescript
import { Roles } from './auth/decorators';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from './auth/guards';
import { UserRole } from './generated/prisma/client';

@Get('admin-only')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
adminEndpoint() {
  return { message: 'Accès administrateur' };
}

@Get('bank-officers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BANK_OFFICER)
bankOfficersEndpoint() {
  return { message: 'Accès agents bancaires et admins' };
}
```

### Récupérer l'utilisateur connecté

Utilisez le décorateur `@CurrentUser()` pour récupérer les informations de l'utilisateur authentifié :

```typescript
import { CurrentUser } from './auth/decorators';

@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user: any) {
  return user;
}
```

### Endpoints de test disponibles

- `GET /auth/profile` - Profil de l'utilisateur connecté (requiert JWT)
- `GET /auth/admin` - Endpoint réservé aux administrateurs (requiert JWT + rôle ADMIN)

## 🗂️ Structure du projet

```
src/
├── auth/              # Module d'authentification
│   ├── dto/          # Data Transfer Objects
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── prisma/            # Service Prisma
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts      # Module principal
└── main.ts           # Point d'entrée

prisma/
├── schema.prisma     # Schéma de base de données
└── seed.ts          # Script de seeding
```

## 🛠️ Scripts disponibles

```bash
# Développement
npm run start:dev      # Démarrer en mode watch
npm run start:debug   # Démarrer en mode debug

# Production
npm run build         # Compiler le projet
npm run start:prod    # Démarrer en production

# Base de données
npm run prisma:generate  # Générer le client Prisma
npm run prisma:migrate   # Appliquer les migrations
npm run prisma:seed      # Seeder la base de données

# Tests
npm run test          # Tests unitaires
npm run test:e2e      # Tests end-to-end
npm run test:cov      # Couverture de code

# Qualité
npm run lint          # Linter le code
npm run format        # Formater le code
```

## 🗄️ Modèles de données

### User
- Gestion des utilisateurs avec rôles (USER, ADMIN, BANK_OFFICER)
- Authentification sécurisée avec hashage bcrypt

### Document
- Stockage des métadonnées des documents
- Types : KYC_IDENTITY, KYC_PROOF_OF_ADDRESS, KYC_BANK_STATEMENT, CONTRACT, OTHER
- Support du chiffrement

### DocumentShare
- Partage de documents entre utilisateurs
- Permissions : READ, READ_WRITE
- Expiration optionnelle

## 🔒 Sécurité

- ✅ Hashage des mots de passe avec bcrypt
- ✅ JWT pour l'authentification
- ✅ Validation des entrées avec class-validator
- ✅ CORS configuré
- 🔜 Chiffrement des documents (à venir)
- 🔜 Guards JWT (à venir)
- 🔜 Rate limiting (à venir)

## 📈 Roadmap

Consultez le fichier [ROADMAP.md](./ROADMAP.md) pour voir le plan de développement complet.

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:cov

# Tests E2E
npm run test:e2e
```

## 🤝 Contribution

1. Créez une branche pour votre fonctionnalité
2. Committez vos changements
3. Poussez vers la branche
4. Ouvrez une Pull Request

## 📝 License

Ce projet est privé et propriétaire.

## 🆘 Support

Pour toute question ou problème, veuillez ouvrir une issue sur le dépôt du projet.

---

**Développé avec ❤️ en utilisant NestJS**
