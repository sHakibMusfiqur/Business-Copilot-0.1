import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token from the verification link' })
  @IsString()
  @MinLength(1, { message: 'Verification token is required' })
  token!: string;
}