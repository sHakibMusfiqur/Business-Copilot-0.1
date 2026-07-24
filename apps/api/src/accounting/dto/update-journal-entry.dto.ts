import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { JournalEntryLineDto } from './create-journal-entry.dto';

export class UpdateJournalEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [JournalEntryLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines?: JournalEntryLineDto[];
}
