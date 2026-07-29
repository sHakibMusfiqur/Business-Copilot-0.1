import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { schoolTemplate, schoolProvisioning } from '../school';

@Injectable()
export class SchoolProvider extends BaseIndustryProvider {
  readonly id = 'school';
  protected readonly template = schoolTemplate;
  protected readonly provisioningConfig = schoolProvisioning;
}
