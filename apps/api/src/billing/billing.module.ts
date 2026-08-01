import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentProcessingService } from './payment-processing.service';
import { GatewayRegistry } from './gateways/gateway-registry';
import { RefundGuard } from './guards/refund.guard';

@Module({
  imports: [PrismaModule, AuditModule, RbacModule],
  controllers: [BillingController],
  providers: [BillingService, PaymentProcessingService, GatewayRegistry, RefundGuard],
  exports: [BillingService, PaymentProcessingService, GatewayRegistry],
})
export class BillingModule {}
