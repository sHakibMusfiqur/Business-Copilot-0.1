import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  currentStep!: number;

  @ApiProperty()
  completedSteps!: string[];

  @ApiPropertyOptional()
  selectedIndustry?: string;

  @ApiPropertyOptional()
  selectedCategory?: string;

  @ApiPropertyOptional()
  selectedCategories?: string[];

  @ApiPropertyOptional()
  orgName?: string;

  @ApiPropertyOptional()
  orgEmail?: string;

  @ApiPropertyOptional()
  orgPhone?: string;

  @ApiPropertyOptional()
  orgWebsite?: string;

  @ApiPropertyOptional()
  orgCountry?: string;

  @ApiPropertyOptional()
  orgState?: string;

  @ApiPropertyOptional()
  orgCity?: string;

  @ApiPropertyOptional()
  orgAddress?: string;

  @ApiPropertyOptional()
  orgTimezone?: string;

  @ApiPropertyOptional()
  orgCurrency?: string;

  @ApiPropertyOptional()
  orgLanguage?: string;

  @ApiPropertyOptional()
  businessProfile?: Record<string, unknown>;

  @ApiProperty()
  selectedModules!: string[];

  @ApiProperty()
  aiEnabled!: boolean;

  @ApiPropertyOptional()
  aiLanguage?: string;

  @ApiPropertyOptional()
  aiPersonality?: string;

  @ApiPropertyOptional()
  selectedPlanId?: string;

  @ApiPropertyOptional()
  planInterval?: string;

  @ApiProperty()
  provisionStatus!: string;

  @ApiPropertyOptional()
  provisionData?: Record<string, unknown>;

  @ApiPropertyOptional()
  organizationId?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
