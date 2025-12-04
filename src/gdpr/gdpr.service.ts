import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class GdprService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async exportUserData(userId: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Récupérer tous les documents de l'utilisateur
    const documents = await this.prisma.document.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        type: true,
        fileSize: true,
        mimeType: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Récupérer les documents partagés avec l'utilisateur
    const sharedDocuments = await this.prisma.documentShare.findMany({
      where: { sharedWithId: userId },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            type: true,
            owner: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Récupérer les partages créés par l'utilisateur
    const sharesCreated = await this.prisma.documentShare.findMany({
      where: {
        document: {
          ownerId: userId,
        },
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        document: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Récupérer les consentements
    const consents = await this.prisma.consent.findMany({
      where: { userId },
    });

    // Récupérer les logs d'audit
    const auditLogs = await this.auditService.getAuditLogs(userId, 1000);

    const exportData = {
      user,
      documents,
      sharedDocuments: sharedDocuments.map((share) => ({
        document: share.document,
        permission: share.permission,
        sharedAt: share.createdAt,
        expiresAt: share.expiresAt,
      })),
      sharesCreated: sharesCreated.map((share) => ({
        document: share.document,
        sharedWith: share.sharedWith,
        permission: share.permission,
        sharedAt: share.createdAt,
        expiresAt: share.expiresAt,
      })),
      consents,
      auditLogs,
      exportedAt: new Date(),
    };

    // Logger l'export
    await this.auditService.log({
      userId,
      action: 'DATA_EXPORT',
      details: { exportedAt: new Date().toISOString() },
      ipAddress,
      userAgent,
    });

    return exportData;
  }

  async deleteUserData(userId: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Supprimer tous les documents et leurs fichiers
    const documents = await this.prisma.document.findMany({
      where: { ownerId: userId },
    });

    for (const document of documents) {
      try {
        await fs.unlink(document.filePath);
      } catch (error) {
        console.error(`Erreur lors de la suppression du fichier ${document.filePath}:`, error);
      }
    }

    // Supprimer tous les partages créés par l'utilisateur
    await this.prisma.documentShare.deleteMany({
      where: {
        document: {
          ownerId: userId,
        },
      },
    });

    // Supprimer tous les partages avec l'utilisateur
    await this.prisma.documentShare.deleteMany({
      where: { sharedWithId: userId },
    });

    // Supprimer tous les documents
    await this.prisma.document.deleteMany({
      where: { ownerId: userId },
    });

    // Supprimer les consentements
    await this.prisma.consent.deleteMany({
      where: { userId },
    });

    // Anonymiser les logs d'audit (garder la trace mais anonymiser)
    await this.prisma.auditLog.updateMany({
      where: { userId },
      data: {
        userId: null,
        details: {
          anonymized: true,
          originalUserId: userId,
          anonymizedAt: new Date().toISOString(),
        },
      },
    });

    // Supprimer l'utilisateur
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // Logger la suppression
    await this.auditService.log({
      action: 'DATA_DELETION',
      entityType: 'User',
      entityId: userId,
      details: { deletedAt: new Date().toISOString() },
      ipAddress,
      userAgent,
    });

    return { message: 'Données utilisateur supprimées avec succès' };
  }

  async updateUserData(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Logger la modification
    await this.auditService.log({
      userId,
      action: 'DATA_RECTIFICATION',
      entityType: 'User',
      entityId: userId,
      details: { updatedFields: Object.keys(data) },
      ipAddress,
      userAgent,
    });

    return updatedUser;
  }

  async grantConsent(
    userId: string,
    consentType: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const consent = await this.prisma.consent.upsert({
      where: {
        userId_type: {
          userId,
          type: consentType as any,
        },
      },
      update: {
        granted: true,
        grantedAt: new Date(),
        revokedAt: null,
        ipAddress,
        userAgent,
      },
      create: {
        userId,
        type: consentType as any,
        granted: true,
        ipAddress,
        userAgent,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CONSENT_GRANTED',
      entityType: 'Consent',
      entityId: consent.id,
      details: { consentType },
      ipAddress,
      userAgent,
    });

    return consent;
  }

  async revokeConsent(
    userId: string,
    consentType: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const consent = await this.prisma.consent.update({
      where: {
        userId_type: {
          userId,
          type: consentType as any,
        },
      },
      data: {
        granted: false,
        revokedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CONSENT_REVOKED',
      entityType: 'Consent',
      entityId: consent.id,
      details: { consentType },
      ipAddress,
      userAgent,
    });

    return consent;
  }

  async getUserConsents(userId: string) {
    return this.prisma.consent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

