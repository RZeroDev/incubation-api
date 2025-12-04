import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { ShareResponseDto } from './dto/share-response.dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { SharePermission } from '../generated/prisma/client';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader un document' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        name: {
          type: 'string',
          example: 'Carte d\'identité',
        },
        type: {
          type: 'string',
          enum: ['KYC_IDENTITY', 'KYC_PROOF_OF_ADDRESS', 'KYC_BANK_STATEMENT', 'CONTRACT', 'OTHER'],
          example: 'KYC_IDENTITY',
        },
        description: {
          type: 'string',
          example: 'Carte d\'identité nationale',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploadé avec succès',
    type: DocumentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Fichier invalide ou trop volumineux',
  })
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10 MB
          new FileTypeValidator({ fileType: /(pdf|jpeg|jpg|png|doc|docx)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() uploadDto: UploadDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.uploadDocument(user.id, file, uploadDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les documents de l\'utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Liste des documents',
    type: [DocumentResponseDto],
  })
  async getUserDocuments(@CurrentUser() user: any) {
    return this.documentsService.getUserDocuments(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un document par son ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails du document',
    type: DocumentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Document non trouvé',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  async getDocumentById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.getDocumentById(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un document' })
  @ApiResponse({
    status: 200,
    description: 'Document supprimé avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Document non trouvé',
  })
  @ApiResponse({
    status: 403,
    description: 'Seul le propriétaire peut supprimer le document',
  })
  async deleteDocument(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.deleteDocument(id, user.id);
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Partager un document avec un autre utilisateur' })
  @ApiResponse({
    status: 201,
    description: 'Document partagé avec succès',
    type: ShareResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Document ou utilisateur non trouvé',
  })
  @ApiResponse({
    status: 403,
    description: 'Seul le propriétaire peut partager le document',
  })
  async shareDocument(
    @Param('id') documentId: string,
    @Body() shareDto: ShareDocumentDto,
    @CurrentUser() user: any,
  ) {
    const expiresAt = shareDto.expiresAt ? new Date(shareDto.expiresAt) : undefined;
    return this.documentsService.shareDocument(documentId, user.id, {
      ...shareDto,
      expiresAt,
    });
  }

  @Get(':id/shares')
  @ApiOperation({ summary: 'Obtenir l\'historique des partages d\'un document' })
  @ApiResponse({
    status: 200,
    description: 'Liste des partages',
    type: [ShareResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Document non trouvé',
  })
  @ApiResponse({
    status: 403,
    description: 'Seul le propriétaire peut voir les partages',
  })
  async getDocumentShares(@Param('id') documentId: string, @CurrentUser() user: any) {
    return this.documentsService.getDocumentShares(documentId, user.id);
  }

  @Delete(':documentId/shares/:shareId')
  @ApiOperation({ summary: 'Révoquer un partage de document' })
  @ApiResponse({
    status: 200,
    description: 'Partage révoqué avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Document ou partage non trouvé',
  })
  @ApiResponse({
    status: 403,
    description: 'Seul le propriétaire peut révoquer un partage',
  })
  async revokeShare(
    @Param('documentId') documentId: string,
    @Param('shareId') shareId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.revokeShare(documentId, shareId, user.id);
  }

  @Patch(':documentId/shares/:shareId/permission')
  @ApiOperation({ summary: 'Modifier la permission d\'un partage' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        permission: {
          type: 'string',
          enum: [SharePermission.READ, SharePermission.READ_WRITE],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Permission modifiée avec succès',
    type: ShareResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Document ou partage non trouvé',
  })
  @ApiResponse({
    status: 403,
    description: 'Seul le propriétaire peut modifier les permissions',
  })
  async updateSharePermission(
    @Param('documentId') documentId: string,
    @Param('shareId') shareId: string,
    @Body('permission') permission: SharePermission,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.updateSharePermission(
      documentId,
      shareId,
      user.id,
      permission,
    );
  }

  @Get('shared/with-me')
  @ApiOperation({ summary: 'Obtenir tous les documents partagés avec moi' })
  @ApiResponse({
    status: 200,
    description: 'Liste des documents partagés',
  })
  async getSharedWithMe(@CurrentUser() user: any) {
    return this.documentsService.getSharedWithMe(user.id);
  }
}

