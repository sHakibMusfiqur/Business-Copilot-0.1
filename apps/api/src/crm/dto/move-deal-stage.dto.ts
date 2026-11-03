import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MoveDealStageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  stageId!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({ description: 'Required when moving into a lost stage' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;
}
