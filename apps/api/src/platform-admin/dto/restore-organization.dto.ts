import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RestoreOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
