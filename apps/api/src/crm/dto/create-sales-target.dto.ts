import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateSalesTargetDto {
  @ApiProperty({ description: 'Inclusive ISO date the target period starts' })
  @IsISO8601({ strict: true })
  periodStart!: string;

  @ApiProperty({ description: 'Inclusive ISO date the target period ends' })
  @IsISO8601({ strict: true })
  periodEnd!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'Omit for an organization-wide target' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
