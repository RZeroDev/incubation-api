# 🔐 Module d'Authentification et d'Autorisation

Ce module gère l'authentification JWT et l'autorisation basée sur les rôles (RBAC) pour l'API SecureVault.

## 📁 Structure

```
auth/
├── decorators/          # Décorateurs personnalisés
│   ├── current-user.decorator.ts
│   ├── public.decorator.ts
│   ├── roles.decorator.ts
│   └── index.ts
├── guards/             # Guards de sécurité
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── index.ts
├── strategies/          # Stratégies Passport
│   └── jwt.strategy.ts
├── dto/                # Data Transfer Objects
│   ├── login.dto.ts
│   └── auth-response.dto.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.module.ts
└── README.md
```

## 🚀 Utilisation

### 1. Route publique

Pour rendre une route accessible sans authentification :

```typescript
import { Public } from './auth/decorators';

@Controller('public')
export class PublicController {
  @Public()
  @Get('info')
  getPublicInfo() {
    return { message: 'Information publique' };
  }
}
```

### 2. Route protégée (authentification requise)

Par défaut, toutes les routes nécessitent une authentification JWT :

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards';
import { CurrentUser } from './auth/decorators';

@Controller('protected')
@UseGuards(JwtAuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}
```

### 3. Route avec restriction de rôle

Pour restreindre l'accès à certains rôles :

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from './auth/guards';
import { Roles } from './auth/decorators';
import { UserRole } from '../generated/prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  getAdminDashboard(@CurrentUser() user: any) {
    return { message: 'Dashboard admin', user };
  }

  @Get('reports')
  @Roles(UserRole.ADMIN, UserRole.BANK_OFFICER)
  getReports(@CurrentUser() user: any) {
    return { message: 'Rapports', user };
  }
}
```

### 4. Rôles disponibles

- `UserRole.USER` - Utilisateur standard
- `UserRole.BANK_OFFICER` - Agent bancaire
- `UserRole.ADMIN` - Administrateur

## 🔧 Configuration

Le module utilise `ConfigService` pour récupérer la clé secrète JWT depuis les variables d'environnement :

```env
JWT_SECRET="votre-secret-jwt-tres-securise"
```

## 📝 Notes importantes

1. **Ordre des guards** : Placez toujours `JwtAuthGuard` avant `RolesGuard`
2. **Décorateur @Public()** : Utilisez-le pour les routes qui ne nécessitent pas d'authentification
3. **@CurrentUser()** : Retourne l'objet utilisateur complet avec les informations de la base de données
4. **Validation automatique** : Le guard vérifie automatiquement si le compte utilisateur est actif

## 🧪 Tests

Pour tester les endpoints protégés :

1. Connectez-vous via `POST /auth/login`
2. Copiez le `accessToken` de la réponse
3. Utilisez-le dans le header : `Authorization: Bearer <token>`
4. Testez les endpoints protégés

