import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested, ArrayMinSize, MinLength } from 'class-validator';

export class JournalEntryLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  accountId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debit!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credit!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiProperty({ type: [JournalEntryLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines!: JournalEntryLineDto[];
}
