import { IsString, IsOptional, IsDateString, IsNumber, Min, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'PeriodStartBeforeEnd', async: false })
export class PeriodStartBeforeEnd implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName] as string | undefined;
    if (!relatedValue || !value) return true;
    return new Date(value) <= new Date(relatedValue);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be on or before periodEnd`;
  }
}

export class CreatePayrollDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ description: 'Period start date (ISO 8601)' })
  @IsDateString()
  @Validate(PeriodStartBeforeEnd, ['periodEnd'])
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
  @ApiPropertyOptional({ description: 'Period start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Period end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

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
