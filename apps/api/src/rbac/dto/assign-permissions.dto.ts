import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ example: ['users.read', 'users.create', 'dashboard.read'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  permissionNames!: string[];
}
