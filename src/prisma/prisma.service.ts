import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set. Please check your .env file.');
    }

    // S'assurer que DATABASE_URL est une chaîne valide
    const connectionString = String(databaseUrl).trim();
    
    if (!connectionString) {
      throw new Error('DATABASE_URL must be a non-empty string');
    }

    // Valider le format de la connection string
    if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
      throw new Error('DATABASE_URL must start with postgresql:// or postgres://');
    }

    const pool = new Pool({
      connectionString,
    });
    const adapter = new PrismaPg(pool);
    
    super({
      adapter,
      log: configService.get<string>('NODE_ENV') === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}

