import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsString()
  @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
  @Matches(/[A-Z]/, { message: 'password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain at least one number' })
  password!: string;
}
