import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';

const allowedSortFields = ['createdAt', 'startDate', 'endDate', 'status', 'type'] as const;
type SortField = (typeof allowedSortFields)[number];

const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
const allowedTypes = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'] as const;

export class QueryLeaveDto {
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

  @ApiPropertyOptional({ enum: allowedStatuses })
  @IsOptional()
  @IsIn(allowedStatuses)
  status?: typeof allowedStatuses[number];

  @ApiPropertyOptional({ enum: allowedTypes })
  @IsOptional()
  @IsIn(allowedTypes)
  type?: typeof allowedTypes[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ enum: allowedSortFields, default: 'createdAt' })
  @IsOptional()
  @IsIn(allowedSortFields)
  sortBy?: SortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
