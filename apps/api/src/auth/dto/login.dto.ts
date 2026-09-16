import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;
}
