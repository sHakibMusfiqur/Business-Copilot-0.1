import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

import { BillingService } from './billing.service';
import { PaymentProcessingService } from './payment-processing.service';
import { RefundGuard } from './guards/refund.guard';
import { ChangePlanDto, CreateCheckoutDto, RefundPaymentDto, StartTrialDto, VerifyPaymentDto } from './dto/billing.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paymentService: PaymentProcessingService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List all active subscription plans' })
  async getPlans() {
    return this.billingService.getPublicPlans();
  }

  @Public()
  @Get('gateways')
  @ApiOperation({ summary: 'List payment gateways' })
  async getGateways() {
    return this.billingService.getGateways();
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current organization subscription' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getSubscription(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.getSubscription(orgId);
  }

  @Post('trial')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.manage'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start a free trial on a plan' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async startTrial(@CurrentUser() user: CurrentUserPayload, @Body() dto: StartTrialDto) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.startTrial(orgId, dto.planId, dto.billingInterval, user.id);
  }

  @Post('change-plan')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.manage'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change subscription plan' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async changePlan(@CurrentUser() user: CurrentUserPayload, @Body() dto: ChangePlanDto) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.changePlan(orgId, dto.planId, dto.billingInterval, user.id);
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get subscription payment history' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getPayments(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.getPaymentHistory(orgId);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get subscription invoices' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getInvoices(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.getInvoices(orgId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.manage'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a payment gateway checkout session' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async createCheckout(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCheckoutDto) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.paymentService.createCheckout(orgId, user.id, dto.planId, dto.billingInterval);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.manage'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify a payment and activate the subscription' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async verifyPayment(@CurrentUser() user: CurrentUserPayload, @Body() dto: VerifyPaymentDto) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.paymentService.verifyPayment(orgId, user.id, dto.paymentId);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard, PermissionGuard, RefundGuard)
  @HttpCode(HttpStatus.OK)
  @Permissions(['billing.manage'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Refund a succeeded payment' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Only an Organization Owner, Super Admin, or Billing Admin can create refunds' })
  async refundPayment(@CurrentUser() user: CurrentUserPayload, @Body() dto: RefundPaymentDto) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.paymentService.refundPayment(orgId, user.id, dto.paymentId, dto.amount);
  }

  @Public()
  @Post('webhooks/:gateway')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive payment gateway webhooks' })
  async handleWebhook(@Param('gateway') gateway: string, @Req() req: Request) {
    const rawBody = this.rawBodyOf(req);
    return this.paymentService.handleWebhook(gateway, rawBody, req.headers as Record<string, string>);
  }

  private rawBodyOf(req: Request): string {
    const body = (req as Request & { rawBody?: Buffer | string }).rawBody;
    if (body !== undefined) {
      return Buffer.isBuffer(body) ? body.toString('utf8') : body;
    }
    return JSON.stringify(req.body ?? {});
  }
}
