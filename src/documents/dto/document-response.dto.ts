import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../../generated/prisma/client';

export class DocumentResponseDto {
  @ApiProperty({ description: 'ID du document' })
  id: string;

  @ApiProperty({ description: 'Nom du document' })
  name: string;

  @ApiProperty({ description: 'Type de document', enum: DocumentType })
  type: DocumentType;

  @ApiProperty({ description: 'Taille du fichier en octets' })
  fileSize: number;

  @ApiProperty({ description: 'Type MIME du fichier' })
  mimeType: string;

  @ApiProperty({ description: 'Description du document', required: false })
  description?: string;

  @ApiProperty({ description: 'Date de création' })
  createdAt: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt: Date;
}

