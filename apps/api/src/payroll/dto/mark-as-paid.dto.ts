import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString } from 'class-validator';

export class MarkAsPaidDto {
  @ApiPropertyOptional({ description: 'Payment date (ISO 8601). Defaults to today if omitted.' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Optional payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
