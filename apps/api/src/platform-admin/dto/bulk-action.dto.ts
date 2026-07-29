import { ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class BulkActionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  organizationIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BulkChangePlanDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  organizationIds!: string[];

  @IsString()
  planSlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
