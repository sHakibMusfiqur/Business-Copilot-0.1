import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class DuplicateRoleDto {
  @ApiProperty({ example: 'Manager Copy', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Role name must be at least 2 characters' })
  @MaxLength(50, { message: 'Role name must not exceed 50 characters' })
  name?: string;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  copyPermissions?: boolean;
}
