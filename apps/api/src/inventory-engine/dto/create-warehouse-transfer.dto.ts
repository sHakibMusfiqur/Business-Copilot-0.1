import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TransferStatus } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class CreateWarehouseTransferDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  sourceWarehouseId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  destWarehouseId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  transferNumber!: string;

  @ApiPropertyOptional({ enum: TransferStatus, default: TransferStatus.DRAFT })
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus = TransferStatus.DRAFT;

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
