import { IsString, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayrollDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ description: 'Period start date (ISO 8601)' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'Period end date (ISO 8601)' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty({ description: 'Basic salary for this period' })
  @IsNumber()
  @Min(0)
  basicSalary!: number;

  @ApiPropertyOptional({ description: 'Allowances', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  allowances?: number;

  @ApiPropertyOptional({ description: 'Deductions', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @ApiPropertyOptional({ description: 'Tax', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Payment date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollDto {
  @ApiPropertyOptional({ description: 'Basic salary for this period' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @ApiPropertyOptional({ description: 'Allowances' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  allowances?: number;

  @ApiPropertyOptional({ description: 'Deductions' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @ApiPropertyOptional({ description: 'Tax' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Payment date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
