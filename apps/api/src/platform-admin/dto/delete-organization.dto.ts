import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
