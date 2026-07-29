import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSystemSettingV2Dto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;

  @IsNotEmpty()
  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
