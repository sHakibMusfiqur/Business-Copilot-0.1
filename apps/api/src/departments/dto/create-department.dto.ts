import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @Length(2, 120, { message: 'name must be between 2 and 120 characters' })
  name!: string;

  @IsString()
  @Length(2, 20, { message: 'code must be between 2 and 20 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'code may only contain letters, numbers, dashes and underscores' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  managerId?: string;
}
