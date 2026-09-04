import { IsOptional, IsString, IsBoolean, Length, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Department name' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ description: 'Department code' })
  @IsOptional()
  @IsString()
  @Length(2, 20)
  code?: string;

  @ApiPropertyOptional({ description: 'Manager user ID' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  managerId?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
