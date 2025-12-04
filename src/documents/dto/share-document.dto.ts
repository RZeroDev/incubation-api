import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { SharePermission } from '../../generated/prisma/client';

export class ShareDocumentDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur avec qui partager le document',
    example: 'uuid-de-l-utilisateur',
  })
  @IsString()
  sharedWithId: string;

  @ApiProperty({
    description: 'Permission accordée',
    enum: SharePermission,
    example: SharePermission.READ,
    default: SharePermission.READ,
  })
  @IsEnum(SharePermission)
  permission: SharePermission;

  @ApiProperty({
    description: 'Date d\'expiration du partage (optionnel)',
    example: '2025-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

