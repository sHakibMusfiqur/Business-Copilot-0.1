import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';

const allowedSortFields = [
  'periodStart',
  'periodEnd',
  'basicSalary',
  'allowances',
  'deductions',
  'tax',
  'netSalary',
  'paymentDate',
  'createdAt',
  'updatedAt',
] as const;
type SortField = (typeof allowedSortFields)[number];

export class QueryPayrollDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter from period start (ISO 8601)' })
  @IsOptional()
  @IsString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Filter to period end (ISO 8601)' })
  @IsOptional()
  @IsString()
  periodEnd?: string;

  @ApiPropertyOptional({ enum: allowedSortFields, default: 'periodEnd' })
  @IsOptional()
  @IsIn(allowedSortFields)
  sortBy?: SortField = 'periodEnd';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
