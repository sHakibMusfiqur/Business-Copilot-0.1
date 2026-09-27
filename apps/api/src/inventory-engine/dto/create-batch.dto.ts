import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BatchStatus } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class CreateBatchDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  productId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  batchNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ enum: BatchStatus, default: BatchStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus = BatchStatus.ACTIVE;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}
