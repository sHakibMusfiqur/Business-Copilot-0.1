import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateInvitationDto {
  @IsString()
  @Length(2, 120, { message: 'name must be between 2 and 120 characters' })
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleIds?: string[];
}
