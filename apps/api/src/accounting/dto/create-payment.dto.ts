import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min, IsEnum, Matches } from 'class-validator';
import { PaymentType } from '@prisma/client';

import { CUID_REGEX } from '../../common/pipes/parse-cuid.pipe';

export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  type!: PaymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ minimum: 0.01 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Receivable ID to allocate this payment to (for customer payments)' })
  @IsOptional()
  @IsString()
  @Matches(CUID_REGEX, { message: 'receivableId must be a valid identifier' })
  receivableId?: string;

  @ApiPropertyOptional({ description: 'Payable ID to allocate this payment to (for supplier payments)' })
  @IsOptional()
  @IsString()
  @Matches(CUID_REGEX, { message: 'payableId must be a valid identifier' })
  payableId?: string;

  @ApiPropertyOptional({ description: 'Invoice ID to allocate this payment to (for standalone invoice payments)' })
  @IsOptional()
  @IsString()
  @Matches(CUID_REGEX, { message: 'invoiceId must be a valid identifier' })
  invoiceId?: string;
}
