import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Code de statut HTTP',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Message d\'erreur',
    example: 'Requête invalide',
  })
  message: string | string[];

  @ApiProperty({
    description: 'Erreur',
    example: 'Requête invalide',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Timestamp de l\'erreur',
    example: '2025-12-03T22:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Chemin de la requête',
    example: '/api/documents',
    required: false,
  })
  path?: string;
}

