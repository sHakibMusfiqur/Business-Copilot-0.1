import { Injectable, Logger } from '@nestjs/common';
import type { IndustryTemplateProvider } from './industry-template-provider.interface';
import type { IndustryTemplate, ProvisioningConfig } from './types';

@Injectable()
export class IndustryTemplateFactory {
  private readonly logger = new Logger(IndustryTemplateFactory.name);
  private readonly providers = new Map<string, IndustryTemplateProvider>();

  constructor(providers: IndustryTemplateProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.id)) {
        this.logger.warn(`Duplicate industry provider registered: ${provider.id}`);
      }
      this.providers.set(provider.id, provider);
    }
    this.logger.log(`Registered ${this.providers.size} industry providers`);
  }

  getProvider(id: string): IndustryTemplateProvider | undefined {
    return this.providers.get(id);
  }

  getTemplate(id: string): IndustryTemplate | undefined {
    return this.providers.get(id)?.getTemplate();
  }

  getProvisioningConfig(id: string): ProvisioningConfig | undefined {
    return this.providers.get(id)?.getProvisioningConfig();
  }

  getAllTemplates(): IndustryTemplate[] {
    return Array.from(this.providers.values()).map((p) => p.getTemplate());
  }

  getAllProviders(): IndustryTemplateProvider[] {
    return Array.from(this.providers.values());
  }
}
