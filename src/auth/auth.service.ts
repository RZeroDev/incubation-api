import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpResponseDto } from './dto/otp-response.dto';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRATION_MINUTES = 2; // Code OTP valide pendant 10 minutes

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Génère un code OTP aléatoire de 6 chiffres
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Nettoie les codes OTP expirés pour un utilisateur
   */
  private async cleanupExpiredOtps(userId: string): Promise<void> {
    await this.prisma.otpCode.deleteMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lt: new Date() } },
          { used: true },
        ],
      },
    });
  }

  /**
   * Étape 1 : Vérifie les identifiants et génère un code OTP
   */
  async login(loginDto: LoginDto): Promise<OtpResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Nettoyer les codes OTP expirés
    await this.cleanupExpiredOtps(user.id);

    // Générer un nouveau code OTP
    const otpCode = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRATION_MINUTES);

    // Stocker le code OTP en base de données
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        code: otpCode,
        expiresAt,
      },
    });

    return {
      message: 'Code OTP généré avec succès',
      otpCode, // Retourné pour développement/test - à retirer en production si nécessaire
    };
  }

  /**
   * Étape 2 : Vérifie le code OTP et retourne le token JWT
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: verifyOtpDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    // Rechercher le code OTP valide
    const otpCode = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        code: verifyOtpDto.code,
        used: false,
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpCode) {
      throw new BadRequestException('Code OTP invalide ou expiré');
    }

    // Marquer le code OTP comme utilisé
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: { used: true },
    });

    // Générer le token JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        role: user.role,
      },
    };
  }
}
