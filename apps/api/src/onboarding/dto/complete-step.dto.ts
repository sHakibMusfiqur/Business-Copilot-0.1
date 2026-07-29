import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class CompleteStepDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  @Max(20)
  step!: number;
}
