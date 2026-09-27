import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class CreateOpeningStockDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  warehouseId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  serialNumberId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalValue?: number = 0;

  @ApiProperty()
  @IsDateString()
  referenceDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}
