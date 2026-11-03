import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ConvertLeadDto {
  @ApiPropertyOptional({ default: true, description: 'Create (or reuse) a contact for this lead' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  createContact?: boolean = true;

  @ApiPropertyOptional({ default: false, description: 'Create a deal in the pipeline' })
  @IsOptional()
  @Type(() => Boolean)
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
