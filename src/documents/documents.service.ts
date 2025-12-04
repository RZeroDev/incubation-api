import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, SharePermission } from '../generated/prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Types de fichiers autorisés
const ALLOWED_MIME_TYPES = {
  [DocumentType.KYC_IDENTITY]: [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
  ],
  [DocumentType.KYC_PROOF_OF_ADDRESS]: [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
  ],
  [DocumentType.KYC_BANK_STATEMENT]: [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ],
  [DocumentType.CONTRACT]: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  [DocumentType.OTHER]: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

// Taille maximale : 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  private readonly uploadPath = path.join(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
    }
  }

  private validateFileType(mimeType: string, documentType: DocumentType): boolean {
    const allowedTypes = ALLOWED_MIME_TYPES[documentType] || [];
    return allowedTypes.includes(mimeType);
  }

  private validateFileSize(size: number): boolean {
    return size > 0 && size <= MAX_FILE_SIZE;
  }

  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    uploadDto: {
      name: string;
      type: DocumentType;
      description?: string;
    },
  ) {
    // Validation du type de fichier
    if (!this.validateFileType(file.mimetype, uploadDto.type)) {
      throw new BadRequestException(
        `Type de fichier non autorisé pour ${uploadDto.type}. Types autorisés: ${ALLOWED_MIME_TYPES[uploadDto.type].join(', ')}`,
      );
    }

    // Validation de la taille
    if (!this.validateFileSize(file.size)) {
      throw new BadRequestException(
        `Fichier trop volumineux. Taille maximale: ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      );
    }

    // Génération d'un nom de fichier unique
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(this.uploadPath, fileName);

    // Sauvegarde du fichier
    await fs.writeFile(filePath, file.buffer);

    // Création de l'enregistrement en base de données
    const document = await this.prisma.document.create({
      data: {
        name: uploadDto.name,
        type: uploadDto.type,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        description: uploadDto.description,
        ownerId: userId,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return document;
  }

  async getUserDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
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
  }

  async getDocumentById(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document non trouvé');
    }

    // Vérifier que l'utilisateur est le propriétaire ou a un partage
    if (document.ownerId !== userId) {
      const share = await this.prisma.documentShare.findUnique({
        where: {
          documentId_sharedWithId: {
            documentId,
            sharedWithId: userId,
          },
        },
      });

      if (!share) {
        throw new ForbiddenException('Accès refusé à ce document');
      }
    }

    return document;
  }

  async deleteDocument(documentId: string, userId: string) {
    const document = await this.getDocumentById(documentId, userId);

    if (document.ownerId !== userId) {
      throw new ForbiddenException('Seul le propriétaire peut supprimer le document');
    }

    // Supprimer le fichier physique
    try {
      await fs.unlink(document.filePath);
    } catch (error) {
      console.error('Erreur lors de la suppression du fichier:', error);
    }

    // Supprimer l'enregistrement en base de données
    await this.prisma.document.delete({
      where: { id: documentId },
    });

    return { message: 'Document supprimé avec succès' };
  }

  async shareDocument(
    documentId: string,
    ownerId: string,
    shareDto: {
      sharedWithId: string;
      permission: SharePermission;
      expiresAt?: Date;
    },
  ) {
    // Vérifier que le document existe et appartient à l'utilisateur
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document non trouvé');
    }

    if (document.ownerId !== ownerId) {
      throw new ForbiddenException('Seul le propriétaire peut partager le document');
    }

    // Vérifier que l'utilisateur ne partage pas avec lui-même
    if (shareDto.sharedWithId === ownerId) {
      throw new BadRequestException('Vous ne pouvez pas partager un document avec vous-même');
    }

    // Vérifier que l'utilisateur avec qui partager existe
    const sharedWithUser = await this.prisma.user.findUnique({
      where: { id: shareDto.sharedWithId },
    });

    if (!sharedWithUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier la date d'expiration
    if (shareDto.expiresAt && shareDto.expiresAt <= new Date()) {
      throw new BadRequestException('La date d\'expiration doit être dans le futur');
    }

    // Créer ou mettre à jour le partage
    const share = await this.prisma.documentShare.upsert({
      where: {
        documentId_sharedWithId: {
          documentId,
          sharedWithId: shareDto.sharedWithId,
        },
      },
      update: {
        permission: shareDto.permission,
        expiresAt: shareDto.expiresAt,
      },
      create: {
        documentId,
        sharedWithId: shareDto.sharedWithId,
        permission: shareDto.permission,
        expiresAt: shareDto.expiresAt,
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
            type: true,
          },
        },
      },
    });

    return share;
  }

  async revokeShare(documentId: string, shareId: string, ownerId: string) {
    // Vérifier que le document existe et appartient à l'utilisateur
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document non trouvé');
    }

    if (document.ownerId !== ownerId) {
      throw new ForbiddenException('Seul le propriétaire peut révoquer un partage');
    }

    // Vérifier que le partage existe
    const share = await this.prisma.documentShare.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException('Partage non trouvé');
    }

    if (share.documentId !== documentId) {
      throw new BadRequestException('Ce partage n\'appartient pas à ce document');
    }

    // Supprimer le partage
    await this.prisma.documentShare.delete({
      where: { id: shareId },
    });

    return { message: 'Partage révoqué avec succès' };
  }

  async getDocumentShares(documentId: string, userId: string) {
    // Vérifier que le document existe et appartient à l'utilisateur
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document non trouvé');
    }

    if (document.ownerId !== userId) {
      throw new ForbiddenException('Seul le propriétaire peut voir les partages');
    }

    // Récupérer tous les partages (actifs et expirés)
    const shares = await this.prisma.documentShare.findMany({
      where: { documentId },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filtrer les partages expirés
    const now = new Date();
    return shares.map((share) => ({
      ...share,
      isExpired: share.expiresAt ? share.expiresAt < now : false,
    }));
  }

  async getSharedWithMe(userId: string) {
    // Récupérer tous les documents partagés avec l'utilisateur
    const shares = await this.prisma.documentShare.findMany({
      where: {
        sharedWithId: userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        document: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return shares.map((share) => ({
      id: share.document.id,
      name: share.document.name,
      type: share.document.type,
      fileSize: share.document.fileSize,
      mimeType: share.document.mimeType,
      description: share.document.description,
      permission: share.permission,
      sharedBy: share.document.owner,
      sharedAt: share.createdAt,
      expiresAt: share.expiresAt,
      createdAt: share.document.createdAt,
      updatedAt: share.document.updatedAt,
    }));
  }

  async updateSharePermission(
    documentId: string,
    shareId: string,
    ownerId: string,
    permission: SharePermission,
  ) {
    // Vérifier que le document existe et appartient à l'utilisateur
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document non trouvé');
    }

    if (document.ownerId !== ownerId) {
      throw new ForbiddenException('Seul le propriétaire peut modifier les permissions');
    }

    // Mettre à jour le partage
    const share = await this.prisma.documentShare.update({
      where: { id: shareId },
      data: { permission },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return share;
  }
}

