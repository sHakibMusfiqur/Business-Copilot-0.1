import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { retailTemplate, retailProvisioning } from '../retail';

@Injectable()
export class RetailProvider extends BaseIndustryProvider {
  readonly id = 'retail';
  protected readonly template = retailTemplate;
  protected readonly provisioningConfig = retailProvisioning;
}
