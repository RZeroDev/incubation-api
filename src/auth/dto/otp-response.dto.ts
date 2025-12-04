import { ApiProperty } from '@nestjs/swagger';

export class OtpResponseDto {
  @ApiProperty({
    description: 'Message indiquant que le code OTP a été généré',
    example: 'Code OTP généré avec succès',
  })
  message: string;

  @ApiProperty({
    description: 'Code OTP généré (pour développement/test uniquement)',
    example: '123456',
  })
  otpCode: string;
}

