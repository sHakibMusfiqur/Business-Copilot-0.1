import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  ownerPassword!: string;

  @IsOptional()
  @IsString()
  planSlug?: string;
}
