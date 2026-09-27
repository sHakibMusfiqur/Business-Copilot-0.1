import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { StockMovementType } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class CreateStockMovementDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  stockId!: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  movementType!: StockMovementType;

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
  totalCost?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceId?: string;

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
