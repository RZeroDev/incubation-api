import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email de l\'utilisateur',
    example: 'admin@securevault.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Mot de passe de l\'utilisateur',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

