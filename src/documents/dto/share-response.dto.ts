import { ApiProperty } from '@nestjs/swagger';
import { SharePermission } from '../../generated/prisma/client';

export class ShareResponseDto {
  @ApiProperty({ description: 'ID du partage' })
  id: string;

  @ApiProperty({ description: 'ID du document partagé' })
  documentId: string;

  @ApiProperty({ description: 'ID de l\'utilisateur avec qui le document est partagé' })
  sharedWithId: string;

  @ApiProperty({
    description: 'Informations de l\'utilisateur',
    example: {
      id: 'uuid',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  })
  sharedWith: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };

  @ApiProperty({ description: 'Permission accordée', enum: SharePermission })
  permission: SharePermission;

  @ApiProperty({ description: 'Date d\'expiration du partage', required: false })
  expiresAt?: Date;

  @ApiProperty({ description: 'Date de création du partage' })
  createdAt: Date;

  @ApiProperty({ description: 'Date de mise à jour du partage' })
  updatedAt: Date;
}

