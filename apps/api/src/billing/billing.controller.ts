import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { BillingService } from './billing.service';
import { ChangePlanDto, StartTrialDto } from './dto/billing.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current organization subscription' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getSubscription(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.getSubscription(orgId);
  }

  @Post('trial')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start a free trial on a plan' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async startTrial(@CurrentUser() user: CurrentUserPayload, @Body() dto: StartTrialDto) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.startTrial(orgId, dto.planId, dto.billingInterval, user.id);
  }

  @Post('change-plan')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change subscription plan' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async changePlan(@CurrentUser() user: CurrentUserPayload, @Body() dto: ChangePlanDto) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.changePlan(orgId, dto.planId, dto.billingInterval, user.id);
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get subscription payment history' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getPayments(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.getPaymentHistory(orgId);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get subscription invoices' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getInvoices(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.billingService.requireOrg(user.organizationId);
    return this.billingService.getInvoices(orgId);
  }
}
