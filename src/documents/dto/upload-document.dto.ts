import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentType } from '../../generated/prisma/client';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Nom du document',
    example: 'Carte d\'identité',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Type de document',
    enum: DocumentType,
    example: DocumentType.KYC_IDENTITY,
  })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty({
    description: 'Description du document (optionnel)',
    example: 'Carte d\'identité nationale',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

