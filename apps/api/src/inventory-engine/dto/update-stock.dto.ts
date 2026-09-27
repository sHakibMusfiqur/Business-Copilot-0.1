import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { StockStatus } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class UpdateStockDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  batchId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  serialNumberId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reservedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  damagedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  returnedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  inTransitQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @ApiPropertyOptional({ enum: StockStatus })
  @IsOptional()
  @IsEnum(StockStatus)
  status?: StockStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}
