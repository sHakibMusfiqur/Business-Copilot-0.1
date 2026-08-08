import { IsInt, IsNotEmpty, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class AskCopilotDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  maxTokens?: number;
}