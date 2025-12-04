import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpResponseDto } from './dto/otp-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Étape 1 : Connexion utilisateur et génération du code OTP' })
  @ApiResponse({
    status: 200,
    description: 'Code OTP généré avec succès',
    type: OtpResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Identifiants invalides',
  })
  async login(@Body() loginDto: LoginDto): Promise<OtpResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Étape 2 : Vérification du code OTP et obtention du token JWT' })
  @ApiResponse({
    status: 200,
    description: 'Code OTP vérifié avec succès, token JWT retourné',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Code OTP invalide ou expiré',
  })
  @ApiResponse({
    status: 401,
    description: 'Utilisateur non trouvé ou compte désactivé',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<AuthResponseDto> {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtenir le profil de l\'utilisateur connecté' })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}
