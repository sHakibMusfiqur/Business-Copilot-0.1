import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { itServicesTemplate, itServicesProvisioning } from '../it-services';

@Injectable()
export class ItServicesProvider extends BaseIndustryProvider {
  readonly id = 'it-services';
  protected readonly template = itServicesTemplate;
  protected readonly provisioningConfig = itServicesProvisioning;
}
