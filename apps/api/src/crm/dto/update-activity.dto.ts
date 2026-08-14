import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ActivityType } from '@prisma/client';

export class UpdateActivityDto {
  @ApiPropertyOptional({ enum: ActivityType })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  dueDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  completed?: boolean;
}
