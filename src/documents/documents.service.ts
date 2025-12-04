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
import { fileTypeFromBuffer } from 'file-type';

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

  /**
   * Vérifie le type réel du fichier en analysant les magic bytes (signatures de fichier)
   * et compare avec le type MIME déclaré par le client
   */
  private async verifyRealFileType(
    fileBuffer: Buffer,
    declaredMimeType: string,
    documentType: DocumentType,
  ): Promise<void> {
    // Vérifier manuellement les magic bytes pour les types spéciaux
    const detectedMimeType = this.detectFileTypeFromMagicBytes(fileBuffer);

    // Si file-type ne peut pas détecter, utiliser notre détection manuelle
    let realMimeType: string | null = null;

    if (detectedMimeType) {
      realMimeType = detectedMimeType;
    } else {
      // Essayer avec file-type pour les autres types
      const fileTypeResult = await fileTypeFromBuffer(fileBuffer);
      if (fileTypeResult) {
        realMimeType = fileTypeResult.mime;
      }
    }

    if (!realMimeType) {
      throw new BadRequestException(
        'Impossible de déterminer le type réel du fichier. Le fichier peut être corrompu ou dans un format non supporté.',
      );
    }

    // Normaliser les types MIME pour la comparaison
    const normalizeMimeType = (mime: string): string => {
      // Normaliser jpg/jpeg
      if (mime === 'image/jpg' || mime === 'image/jpeg') {
        return 'image/jpeg';
      }
      return mime;
    };

    const normalizedRealType = normalizeMimeType(realMimeType);
    const normalizedDeclaredType = normalizeMimeType(declaredMimeType);

    // Vérifier que le type réel correspond au type déclaré
    if (normalizedRealType !== normalizedDeclaredType) {
      throw new BadRequestException(
        `Type de fichier suspect : le fichier prétend être "${declaredMimeType}" mais est en réalité "${realMimeType}". ` +
          'Le fichier peut être malveillant ou corrompu.',
      );
    }

    // Vérifier que le type réel est autorisé pour ce type de document
    const allowedTypes = ALLOWED_MIME_TYPES[documentType] || [];
    const normalizedAllowedTypes = allowedTypes.map(normalizeMimeType);

    if (!normalizedAllowedTypes.includes(normalizedRealType)) {
      throw new BadRequestException(
        `Type de fichier réel "${realMimeType}" non autorisé pour ${documentType}. ` +
          `Types autorisés: ${allowedTypes.join(', ')}`,
      );
    }
  }

  /**
   * Détecte le type de fichier en analysant les magic bytes (signatures de fichier)
   * Cette méthode vérifie les premiers octets du fichier pour identifier son type réel
   */
  private detectFileTypeFromMagicBytes(buffer: Buffer): string | null {
    if (buffer.length < 4) {
      return null;
    }

    if (buffer.subarray(0, 4).toString('ascii') === '%PDF') {
      return 'application/pdf';
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      if (
        (buffer[2] === 0x03 && buffer[3] === 0x04) ||
        (buffer[2] === 0x05 && buffer[3] === 0x06)
      ) {
        const bufferString = buffer.subarray(0, Math.min(1024, buffer.length)).toString('utf-8');
        if (bufferString.includes('[Content_Types].xml')) {
          return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
      }
    }

    if (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1
    ) {
      return 'application/msword';
    }

    return null;
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
    // Validation de la taille (avant toute autre opération)
    if (!this.validateFileSize(file.size)) {
      throw new BadRequestException(
        `Fichier trop volumineux. Taille maximale: ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      );
    }

    // Validation du type de fichier déclaré
    if (!this.validateFileType(file.mimetype, uploadDto.type)) {
      throw new BadRequestException(
        `Type de fichier non autorisé pour ${uploadDto.type}. Types autorisés: ${ALLOWED_MIME_TYPES[uploadDto.type].join(', ')}`,
      );
    }

    // Vérification du type réel du fichier (magic bytes)
    await this.verifyRealFileType(file.buffer, file.mimetype, uploadDto.type);

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

