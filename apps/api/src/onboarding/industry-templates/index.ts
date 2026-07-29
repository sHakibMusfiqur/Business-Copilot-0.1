import type { IndustryTemplate, ProvisioningConfig, IndustryCategory } from './types';
import { garmentsTemplate, garmentsProvisioning } from './garments';
import { hospitalTemplate, hospitalProvisioning } from './hospital';
import { schoolTemplate, schoolProvisioning } from './school';
import { restaurantTemplate, restaurantProvisioning } from './restaurant';
import { retailTemplate, retailProvisioning } from './retail';
import { manufacturingTemplate, manufacturingProvisioning } from './manufacturing';
import { pharmacyTemplate, pharmacyProvisioning } from './pharmacy';
import { itServicesTemplate, itServicesProvisioning } from './it-services';

export type { IndustryTemplate, ProvisioningConfig, IndustryCategory };

export const industryTemplates: IndustryTemplate[] = [
  garmentsTemplate,
  hospitalTemplate,
  schoolTemplate,
  restaurantTemplate,
  retailTemplate,
  manufacturingTemplate,
  pharmacyTemplate,
  itServicesTemplate,
];

export const provisioningConfigs: Record<string, ProvisioningConfig> = {
  garments: garmentsProvisioning,
  hospital: hospitalProvisioning,
  school: schoolProvisioning,
  restaurant: restaurantProvisioning,
  retail: retailProvisioning,
  manufacturing: manufacturingProvisioning,
  pharmacy: pharmacyProvisioning,
  'it-services': itServicesProvisioning,
};

export function getTemplateById(id: string): IndustryTemplate | undefined {
  return industryTemplates.find((t) => t.id === id);
}

export function getProvisioningConfig(id: string): ProvisioningConfig | undefined {
  return provisioningConfigs[id];
}

export {
  garmentsTemplate, garmentsProvisioning,
  hospitalTemplate, hospitalProvisioning,
  schoolTemplate, schoolProvisioning,
  restaurantTemplate, restaurantProvisioning,
  retailTemplate, retailProvisioning,
  manufacturingTemplate, manufacturingProvisioning,
  pharmacyTemplate, pharmacyProvisioning,
  itServicesTemplate, itServicesProvisioning,
};
