import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { UserRole } from '../generated/prisma/client';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BANK_OFFICER)
  @ApiOperation({ summary: 'Consulter les logs d\'audit (Admin/Bank Officer uniquement)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des logs d\'audit',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle admin ou bank officer requis',
  })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    
    if (action) {
      return this.auditService.getAuditLogsByAction(action, limitNum);
    }
    
    return this.auditService.getAuditLogs(userId, limitNum);
  }

  @Get('logs/my')
  @ApiOperation({ summary: 'Consulter mes propres logs d\'audit' })
  @ApiResponse({
    status: 200,
    description: 'Liste de mes logs d\'audit',
  })
  async getMyAuditLogs(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.auditService.getAuditLogs(user.id, limitNum);
  }

  @Get('logs/entity/:entityType/:entityId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BANK_OFFICER)
  @ApiOperation({ summary: 'Consulter les logs d\'une entité spécifique' })
  @ApiResponse({
    status: 200,
    description: 'Logs de l\'entité',
  })
  async getEntityLogs(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getAuditLogsByEntity(entityType, entityId);
  }
}

