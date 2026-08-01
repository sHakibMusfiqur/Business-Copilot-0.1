import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, IsArray, IsBoolean, IsEmail,
  Min, Max, MinLength, MaxLength, IsObject,
} from 'class-validator';

export class UpdateSessionDto {
  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  currentStep?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  selectedIndustry?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  selectedCategory?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedCategories?: string[];

  @ApiPropertyOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  orgName?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  orgEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgWebsite?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgCountry?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgState?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgCity?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgTimezone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgCurrency?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  orgLanguage?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  businessProfile?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  selectedModules?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  aiEnabled?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  aiLanguage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  aiPersonality?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  selectedPlanId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  planInterval?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  version?: number;
}
