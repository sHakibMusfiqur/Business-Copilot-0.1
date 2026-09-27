import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { AdjustmentType } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class CreateStockAdjustmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  stockId!: string;

  @ApiProperty({ enum: AdjustmentType })
  @IsEnum(AdjustmentType)
  adjustmentType!: AdjustmentType;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  quantityBefore!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  quantityAfter!: number;

  @ApiProperty()
  @IsInt()
  adjustmentQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

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
