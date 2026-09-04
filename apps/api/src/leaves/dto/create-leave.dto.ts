import { IsString, IsOptional, IsDateString, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ description: 'Leave start date (ISO 8601)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Leave end date (ISO 8601)' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Leave type', enum: ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'], default: 'ANNUAL' })
  @IsOptional()
  @IsIn(['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'])
  type?: string;

  @ApiPropertyOptional({ description: 'Reason for leave' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateLeaveDto {
  @ApiPropertyOptional({ description: 'Leave start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Leave end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Leave type', enum: ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'] })
  @IsOptional()
  @IsIn(['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'])
  type?: string;

  @ApiPropertyOptional({ description: 'Reason for leave' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
