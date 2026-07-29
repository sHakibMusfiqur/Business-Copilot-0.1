import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import { restaurantTemplate, restaurantProvisioning } from '../restaurant';

@Injectable()
export class RestaurantProvider extends BaseIndustryProvider {
  readonly id = 'restaurant';
  protected readonly template = restaurantTemplate;
  protected readonly provisioningConfig = restaurantProvisioning;
}
