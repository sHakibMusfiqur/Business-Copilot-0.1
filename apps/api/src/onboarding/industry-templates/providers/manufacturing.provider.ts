import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { manufacturingTemplate, manufacturingProvisioning } from '../manufacturing';

@Injectable()
export class ManufacturingProvider extends BaseIndustryProvider {
  readonly id = 'manufacturing';
  protected readonly template = manufacturingTemplate;
  protected readonly provisioningConfig = manufacturingProvisioning;
}
