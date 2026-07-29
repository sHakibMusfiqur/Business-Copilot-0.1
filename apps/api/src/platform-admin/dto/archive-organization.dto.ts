import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ArchiveOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
