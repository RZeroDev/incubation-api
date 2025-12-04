import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Démarrage du seeding...');

  // Hash du mot de passe par défaut
  const defaultPassword = await bcrypt.hash('SecureVault2025!', 10);

  // Création d'un administrateur
  const admin = await prisma.user.upsert({
    where: { email: 'admin@securevault.com' },
    update: {},
    create: {
      email: 'admin@securevault.com',
      password: defaultPassword,
      firstName: 'Admin',
      lastName: 'SecureVault',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Administrateur créé:', admin.email);

  // Création d'un agent bancaire
  const bankOfficer = await prisma.user.upsert({
    where: { email: 'officer@securevault.com' },
    update: {},
    create: {
      email: 'officer@securevault.com',
      password: defaultPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.BANK_OFFICER,
      isActive: true,
    },
  });

  console.log('✅ Agent bancaire créé:', bankOfficer.email);

  // Création d'un utilisateur standard
  const user = await prisma.user.upsert({
    where: { email: 'user@securevault.com' },
    update: {},
    create: {
      email: 'user@securevault.com',
      password: defaultPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.USER,
      isActive: true,
    },
  });

  console.log('✅ Utilisateur créé:', user.email);

  console.log('🎉 Seeding terminé avec succès!');
  console.log('\n📋 Comptes créés:');
  console.log('   - admin@securevault.com / SecureVault2025! (ADMIN)');
  console.log('   - officer@securevault.com / SecureVault2025! (BANK_OFFICER)');
  console.log('   - user@securevault.com / SecureVault2025! (USER)');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

