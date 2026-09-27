import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { StockStatus } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class CreateStockDto {
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

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reservedQuantity?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  damagedQuantity?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  returnedQuantity?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  inTransitQuantity?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  safetyStock?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number = 0;

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

  @ApiPropertyOptional({ enum: StockStatus, default: StockStatus.ACTIVE })
  @IsOptional()
  @IsEnum(StockStatus)
  status?: StockStatus = StockStatus.ACTIVE;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}
