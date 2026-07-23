import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateProductStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
