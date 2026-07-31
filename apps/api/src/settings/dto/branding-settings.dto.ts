import { IsString, IsOptional, Matches, MaxLength, Length } from 'class-validator';

export class BrandingSettingsDto {
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'brandName must be between 2 and 120 characters' })
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{6})$/, { message: 'primaryColor must be a valid 6-digit hex color' })
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{6})$/, { message: 'secondaryColor must be a valid 6-digit hex color' })
  secondaryColor?: string;

  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{6})$/, { message: 'accentColor must be a valid 6-digit hex color' })
  accentColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;
}
