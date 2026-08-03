import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ClonePermissionsDto {
  @ApiProperty({ example: 'role-id-123' })
  @IsString()
  @IsNotEmpty({ message: 'Source role id is required' })
  sourceRoleId!: string;
}
