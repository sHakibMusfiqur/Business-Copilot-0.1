import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class ProvisionSessionDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100)
  selectedIndustry?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100)
  orgName?: string | null;
}