import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { garmentsTemplate, garmentsProvisioning } from '../garments';

@Injectable()
export class GarmentsProvider extends BaseIndustryProvider {
  readonly id = 'garments';
  protected readonly template = garmentsTemplate;
  protected readonly provisioningConfig = garmentsProvisioning;
}
