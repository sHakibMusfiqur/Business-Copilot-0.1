import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class LookupByEmailDto {
  @ApiProperty({ example: 'john@acme.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;
}
