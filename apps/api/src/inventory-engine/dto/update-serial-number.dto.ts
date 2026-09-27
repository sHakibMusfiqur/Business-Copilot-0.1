import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SerialStatus } from '@prisma/client';
import { IsSafeJson } from '../../common/validators/safe-json.validator';

export class UpdateSerialNumberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serialNumber?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  batchId?: string | null;

  @ApiPropertyOptional({ enum: SerialStatus })
  @IsOptional()
  @IsEnum(SerialStatus)
  status?: SerialStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsSafeJson()
  metadata?: Record<string, unknown>;
}
