import type { IndustryTemplateProvider, ProvisioningContext } from './industry-template-provider.interface';
import type { IndustryTemplate, ProvisioningConfig } from './types';

export abstract class BaseIndustryProvider implements IndustryTemplateProvider {
  abstract readonly id: string;
  protected abstract readonly template: IndustryTemplate;
  protected abstract readonly provisioningConfig: ProvisioningConfig;

  getTemplate(): IndustryTemplate {
    return this.template;
  }

  getProvisioningConfig(): ProvisioningConfig {
    return this.provisioningConfig;
  }

  async validate(_context: ProvisioningContext): Promise<void> {}

  async prepare(_tx: unknown, _context: ProvisioningContext): Promise<void> {}

  async provision(_tx: unknown, _context: ProvisioningContext, _orgId: string): Promise<void> {}

  async postProvision(_context: ProvisioningContext, _orgId: string): Promise<void> {}

  async cleanup(_sessionId: string): Promise<void> {}
}
