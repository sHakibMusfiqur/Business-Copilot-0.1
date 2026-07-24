import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min, IsEnum, IsUUID } from 'class-validator';
import { PaymentType } from '@prisma/client';

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
  @IsUUID()
  receivableId?: string;

  @ApiPropertyOptional({ description: 'Payable ID to allocate this payment to (for supplier payments)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  payableId?: string;
}
