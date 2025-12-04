import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { GdprService } from './gdpr.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { ExportDataResponseDto } from './dto/export-data.dto';

@ApiTags('GDPR')
@Controller('gdpr')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Get('export')
  @ApiOperation({ summary: 'Exporter toutes les données de l\'utilisateur (Droit d\'accès)' })
  @ApiResponse({
    status: 200,
    description: 'Données exportées avec succès',
    type: ExportDataResponseDto,
  })
  async exportData(@CurrentUser() user: any, @Req() req: any) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.gdprService.exportUserData(user.id, ipAddress, userAgent);
  }

  @Delete('data')
  @ApiOperation({ summary: 'Supprimer toutes les données de l\'utilisateur (Droit à l\'effacement)' })
  @ApiResponse({
    status: 200,
    description: 'Données supprimées avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé',
  })
  async deleteData(@CurrentUser() user: any, @Req() req: any) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.gdprService.deleteUserData(user.id, ipAddress, userAgent);
  }

  @Patch('data')
  @ApiOperation({ summary: 'Modifier les données personnelles (Droit de rectification)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Données modifiées avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé',
  })
  async updateData(
    @CurrentUser() user: any,
    @Body() data: { firstName?: string; lastName?: string },
    @Req() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.gdprService.updateUserData(user.id, data, ipAddress, userAgent);
  }

  @Post('consent/:type')
  @ApiOperation({ summary: 'Accorder un consentement' })
  @ApiResponse({
    status: 201,
    description: 'Consentement accordé',
  })
  async grantConsent(
    @Param('type') type: string,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.gdprService.grantConsent(user.id, type, ipAddress, userAgent);
  }

  @Delete('consent/:type')
  @ApiOperation({ summary: 'Révoquer un consentement' })
  @ApiResponse({
    status: 200,
    description: 'Consentement révoqué',
  })
  async revokeConsent(
    @Param('type') type: string,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.gdprService.revokeConsent(user.id, type, ipAddress, userAgent);
  }

  @Get('consents')
  @ApiOperation({ summary: 'Obtenir tous les consentements de l\'utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Liste des consentements',
  })
  async getConsents(@CurrentUser() user: any) {
    return this.gdprService.getUserConsents(user.id);
  }
}

