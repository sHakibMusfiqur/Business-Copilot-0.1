import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * JSON bodies should carry real booleans; tolerate 'true'/'false' strings but
 * pass anything else through so @IsBoolean rejects it with 400 instead of
 * coercing garbage (Boolean('false') === true — e.g. createContact: 'false'
 * must never create a contact).
 */
function toBooleanBody(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ConvertLeadDto {
  @ApiPropertyOptional({ default: true, description: 'Create (or reuse) a contact for this lead' })
  @IsOptional()
  @Transform(({ value }) => toBooleanBody(value))
  @IsBoolean()
  createContact?: boolean = true;

  @ApiPropertyOptional({ default: false, description: 'Create a deal in the pipeline' })
  @IsOptional()
  @Transform(({ value }) => toBooleanBody(value))
  @IsBoolean()
  createDeal?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dealTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dealValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pipelineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  stageId?: string;
}
