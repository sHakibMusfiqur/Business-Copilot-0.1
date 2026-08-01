import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class ChangePlanDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}

export class StartTrialDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId!: string;
}

export class RefundPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
