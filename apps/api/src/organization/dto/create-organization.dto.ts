import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'Organization name must be at least 2 characters' })
  @MaxLength(100, { message: 'Organization name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-'.&]+$/, {
    message: 'Organization name can only contain letters, numbers, spaces, hyphens, apostrophes, periods, and ampersands',
  })
  name!: string;
}
