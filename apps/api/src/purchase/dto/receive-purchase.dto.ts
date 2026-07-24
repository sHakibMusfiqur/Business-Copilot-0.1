import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReceivePurchaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
