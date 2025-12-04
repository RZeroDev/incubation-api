import { ApiProperty } from '@nestjs/swagger';

export class ExportDataResponseDto {
  @ApiProperty({ description: 'Données de l\'utilisateur' })
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  };

  @ApiProperty({ description: 'Documents de l\'utilisateur' })
  documents: any[];

  @ApiProperty({ description: 'Documents partagés avec l\'utilisateur' })
  sharedDocuments: any[];

  @ApiProperty({ description: 'Partages créés par l\'utilisateur' })
  sharesCreated: any[];

  @ApiProperty({ description: 'Consentements' })
  consents: any[];

  @ApiProperty({ description: 'Logs d\'audit' })
  auditLogs: any[];

  @ApiProperty({ description: 'Date d\'export' })
  exportedAt: Date;
}

