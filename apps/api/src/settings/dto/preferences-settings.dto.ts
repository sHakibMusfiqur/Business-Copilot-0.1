import { IsOptional, IsString, Length } from 'class-validator';

export class PreferencesSettingsDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  language?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  dateFormat?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  weekStartsOn?: string;
}
