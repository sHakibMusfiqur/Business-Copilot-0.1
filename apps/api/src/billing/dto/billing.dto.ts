import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
