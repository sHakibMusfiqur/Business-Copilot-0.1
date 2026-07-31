import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class TaxSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultTaxRate?: number;

  @IsOptional()
  @IsString()
  @IsIn(['Exclusive', 'Inclusive'])
  calculationMethod?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxLabel?: string;

  @IsOptional()
  @IsBoolean()
  enableShippingTax?: boolean;

  @IsOptional()
  @IsBoolean()
  countryRates?: boolean;

  @IsOptional()
  @IsBoolean()
  taxProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  taxServices?: boolean;

  @IsOptional()
  @IsBoolean()
  taxShipping?: boolean;
}
