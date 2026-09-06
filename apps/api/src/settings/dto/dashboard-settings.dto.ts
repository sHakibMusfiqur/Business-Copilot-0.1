import { IsArray, IsOptional, IsString, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class DashboardWidgetOverrideDto {
  @ApiPropertyOptional({ description: 'Widget IDs to explicitly enable' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  enabledWidgets?: string[];

  @ApiPropertyOptional({ description: 'Widget IDs to hide from the dashboard' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  hiddenWidgets?: string[];

  @ApiPropertyOptional({ description: 'Custom ordering of widget IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  widgetOrder?: string[];

  @ApiPropertyOptional({ description: 'KPI widget IDs to show' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  kpis?: string[];

  @ApiPropertyOptional({ description: 'Chart widget IDs to show' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  charts?: string[];

  @ApiPropertyOptional({ description: 'Secondary widget IDs to show' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  secondary?: string[];

  @ApiPropertyOptional({ description: 'Alert widget IDs to show' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  alerts?: string[];
}

export class DashboardSettingsDto {
  @ApiPropertyOptional({ description: 'Dashboard widget configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardWidgetOverrideDto)
  dashboard?: DashboardWidgetOverrideDto;
}
