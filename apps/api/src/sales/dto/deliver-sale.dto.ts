import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeliverSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
