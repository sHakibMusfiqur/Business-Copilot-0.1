import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSupplierStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
