import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PaymentGateway as PaymentGatewayRecord } from '@prisma/client';

import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { GatewayConfig, PaymentGateway } from './payment-gateway.interface';
import { StripeProvider } from './stripe.provider';
import { SslcommerzProvider } from './sslcommerz.provider';
import { BkashProvider } from './bkash.provider';
import { NagadProvider } from './nagad.provider';
import { PaypalProvider } from './paypal.provider';

/**
 * Resolves the configured `PaymentGateway` records from the database into
 * concrete provider instances. The active gateway is chosen automatically by
 * `isEnabled` + `sortOrder`, so enabling a gateway in the DB is enough to
 * route real payments through it.
 */
@Injectable()
export class GatewayRegistry {
  private readonly logger = new Logger(GatewayRegistry.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** The web application base URL used to build checkout success/cancel URLs. */
  getWebUrl(): string {
    return this.configService.webUrl;
  }

  /** Finds the single active gateway (isEnabled) with the lowest sortOrder. */
  async getActiveGatewayRecord(): Promise<PaymentGatewayRecord> {
    const gateway = await this.prisma.paymentGateway.findFirst({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }],
    });
    if (!gateway) {
      throw new NotFoundException('No payment gateway is enabled');
    }
    return gateway;
  }

  /** Resolves the active gateway to a configured provider instance. */
  async getActiveProvider(): Promise<PaymentGateway> {
    const record = await this.getActiveGatewayRecord();
    const provider = this.buildProvider(record);
    if (!provider.isConfigured()) {
      // The gateway is enabled in the DB but lacks credentials (e.g. empty
      // STRIPE_* keys), so payments cannot be taken. Surface a friendly,
      // non-500 error so the client can fall back to the free trial.
      this.logger.warn(`Active payment gateway '${record.code}' is enabled but not configured`);
      throw new ServiceUnavailableException(
        'Online payment is not available right now. Please try again later or start your free trial.',
      );
    }
    return provider;
  }

  /** Resolves a gateway by code to a configured provider instance. */
  async getProviderByCode(code: string): Promise<PaymentGateway> {
    const record = await this.prisma.paymentGateway.findUnique({ where: { code } });
    if (!record) {
      throw new NotFoundException(`Payment gateway '${code}' is not configured`);
    }
    const provider = this.buildProvider(record);
    if (!provider.isConfigured()) {
      // Same guard as getActiveProvider: an enabled-but-unconfigured gateway
      // (e.g. scaffold SSLCommerz/bKash/Nagad/PayPal or empty STRIPE_* keys)
      // must never surface a raw 500 on the public webhook path.
      this.logger.warn(`Payment gateway '${record.code}' is enabled but not configured`);
      throw new ServiceUnavailableException(
        'Online payment is not available right now. Please try again later or start your free trial.',
      );
    }
    return provider;
  }

  private buildProvider(record: PaymentGatewayRecord): PaymentGateway {
    const config = (record.config ?? {}) as GatewayConfig;
    switch (record.code) {
      case 'stripe':
      case 'card':
        return new StripeProvider(config, this.configService);
      case 'sslcommerz':
        return new SslcommerzProvider(config, this.configService);
      case 'bkash':
        return new BkashProvider(config, this.configService);
      case 'nagad':
        return new NagadProvider(config, this.configService);
      case 'paypal':
        return new PaypalProvider(config, this.configService);
      default:
        this.logger.warn(`Unsupported payment gateway code: ${record.code}`);
        throw new NotFoundException(`Payment gateway '${record.code}' is not supported`);
    }
  }
}
