import { IsEnum, IsIn, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

const SORT_BY_VALUES = ['createdAt', 'action', 'entity', 'userId'] as const;

export class AdminAuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @IsIn(SORT_BY_VALUES)
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortOrder?: 'asc' | 'desc';
}
