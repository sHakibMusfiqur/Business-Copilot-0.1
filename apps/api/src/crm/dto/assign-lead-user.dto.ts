import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignLeadUserDto {
  @ApiPropertyOptional({ nullable: true, description: 'Omit or null to unassign the lead' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  assignedToId?: string | null;
}
