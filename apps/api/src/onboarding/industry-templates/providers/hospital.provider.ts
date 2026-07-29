import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { hospitalTemplate, hospitalProvisioning } from '../hospital';

@Injectable()
export class HospitalProvider extends BaseIndustryProvider {
  readonly id = 'hospital';
  protected readonly template = hospitalTemplate;
  protected readonly provisioningConfig = hospitalProvisioning;
}
