import { IsString, IsOptional, IsBoolean, Matches, MaxLength, Length } from 'class-validator';

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;
const FONT_RE = /^[A-Za-z0-9][A-Za-z0-9 _'",.-]{0,79}$/;

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
  @Matches(HEX_COLOR_RE, { message: 'primaryColor must be a valid 6-digit hex color' })
  primaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR_RE, { message: 'secondaryColor must be a valid 6-digit hex color' })
  secondaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR_RE, { message: 'accentColor must be a valid 6-digit hex color' })
  accentColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  darkLogoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  loginBackgroundUrl?: string;

  @IsOptional()
  @IsString()
  loginIllustrationUrl?: string;

  @IsOptional()
  @Matches(FONT_RE, { message: 'fontFamily must be a font name or CSS font stack' })
  @MaxLength(80)
  fontFamily?: string;

  @IsOptional()
  @Matches(FONT_RE, { message: 'headingFont must be a font name or CSS font stack' })
  @MaxLength(80)
  headingFont?: string;

  @IsOptional()
  @Matches(/^(light|dark|system|default)$/, {
    message: 'dashboardTheme must be one of: light, dark, system, default',
  })
  dashboardTheme?: 'light' | 'dark' | 'system' | 'default';

  @IsOptional()
  @IsBoolean()
  letterheadEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  letterheadText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentFooterText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  invoiceFooterText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reportFooterText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  emailFooterText?: string;
}
