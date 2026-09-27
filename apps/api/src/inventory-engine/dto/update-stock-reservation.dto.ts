import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ReservationStatus } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class UpdateStockReservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reservedQuantity?: number;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}
