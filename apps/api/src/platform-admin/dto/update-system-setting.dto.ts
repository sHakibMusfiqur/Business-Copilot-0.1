import { IsString } from 'class-validator';

export class UpdateSystemSettingDto {
  @IsString()
  key!: string;

  value!: unknown;
}
