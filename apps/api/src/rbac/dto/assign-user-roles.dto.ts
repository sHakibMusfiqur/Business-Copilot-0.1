import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({ example: ['role-id-1', 'role-id-2'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  roleIds!: string[];
}
