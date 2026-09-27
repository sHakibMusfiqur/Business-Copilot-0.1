import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SerialStatus } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class CreateSerialNumberDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  productId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serialNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  batchId?: string;

  @ApiPropertyOptional({ enum: SerialStatus, default: SerialStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(SerialStatus)
  status?: SerialStatus = SerialStatus.AVAILABLE;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}
