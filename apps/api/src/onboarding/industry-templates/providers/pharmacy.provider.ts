import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { pharmacyTemplate, pharmacyProvisioning } from '../pharmacy';

@Injectable()
export class PharmacyProvider extends BaseIndustryProvider {
  readonly id = 'pharmacy';
  protected readonly template = pharmacyTemplate;
  protected readonly provisioningConfig = pharmacyProvisioning;
}
