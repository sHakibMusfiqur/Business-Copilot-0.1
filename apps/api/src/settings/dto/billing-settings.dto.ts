import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class BillingSettingsDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  @Length(5, 255)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  currency?: string;
}
