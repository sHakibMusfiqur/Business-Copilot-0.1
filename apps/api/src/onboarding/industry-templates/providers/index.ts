import { Provider } from '@nestjs/common';
import { GarmentsProvider } from './garments.provider';
import { HospitalProvider } from './hospital.provider';
import { SchoolProvider } from './school.provider';
import { RestaurantProvider } from './restaurant.provider';
import { RetailProvider } from './retail.provider';
import { ManufacturingProvider } from './manufacturing.provider';
import { PharmacyProvider } from './pharmacy.provider';
import { ItServicesProvider } from './it-services.provider';
import { IndustryTemplateFactory } from '../industry-template.factory';

export const INDUSTRY_PROVIDER_CLASSES = [
  GarmentsProvider,
  HospitalProvider,
  SchoolProvider,
  RestaurantProvider,
  RetailProvider,
  ManufacturingProvider,
  PharmacyProvider,
  ItServicesProvider,
];

export function createIndustryTemplateFactory(): Provider {
  return {
    provide: IndustryTemplateFactory,
    useFactory: (
      garments: GarmentsProvider,
      hospital: HospitalProvider,
      school: SchoolProvider,
      restaurant: RestaurantProvider,
      retail: RetailProvider,
      manufacturing: ManufacturingProvider,
      pharmacy: PharmacyProvider,
      itServices: ItServicesProvider,
    ) => new IndustryTemplateFactory([
      garments, hospital, school, restaurant,
      retail, manufacturing, pharmacy, itServices,
    ]),
    inject: INDUSTRY_PROVIDER_CLASSES,
  };
}
