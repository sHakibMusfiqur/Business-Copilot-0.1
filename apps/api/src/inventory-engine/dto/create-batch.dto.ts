import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BatchStatus } from '@prisma/client';

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
  @IsObject()
  metadata?: Record<string, unknown>;
}
