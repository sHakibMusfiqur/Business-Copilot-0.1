import type { IndustryTemplate, ProvisioningConfig } from './types';

export const hospitalTemplate: IndustryTemplate = {
  id: 'hospital',
  name: 'Hospital & Healthcare',
  description: 'Hospitals, clinics, diagnostic centers, and healthcare service providers',
  icon: 'hospital',
  color: '#ef4444',
  categories: [
    { id: 'hospital-general', name: 'General Hospital', description: 'Multi-specialty hospital with inpatient/outpatient services' },
    { id: 'hospital-clinic', name: 'Clinic', description: 'Single or multi-specialty clinic' },
    { id: 'hospital-diagnostic', name: 'Diagnostic Center', description: 'Lab testing and diagnostic imaging services' },
    { id: 'hospital-pharmacy', name: 'Pharmacy', description: 'Retail or hospital pharmacy operations' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 25,
  estimatedMonthlyPrice: 199,
};

export const hospitalProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Medical Staff', description: 'Doctors, nurses, and clinical staff' },
    { name: 'Pharmacy', description: 'Medicine dispensing and inventory' },
    { name: 'Laboratory', description: 'Diagnostic testing and lab services' },
    { name: 'Radiology', description: 'X-ray, MRI, CT scan, and imaging' },
    { name: 'Administration', description: 'Hospital administration and management' },
    { name: 'Finance & Billing', description: 'Patient billing, insurance, and accounting' },
    { name: 'HR & Payroll', description: 'Staff management and payroll' },
    { name: 'Housekeeping', description: 'Facility maintenance and cleaning' },
  ],
  roles: [
    { name: 'Doctor', description: 'Medical practitioner', permissions: ['patients:read', 'prescriptions:write'] },
    { name: 'Nurse', description: 'Patient care and support', permissions: ['patients:read', 'vitals:write'] },
    { name: 'Pharmacist', description: 'Medicine dispensing', permissions: ['inventory:read', 'pharmacy:manage'] },
    { name: 'Lab Technician', description: 'Diagnostic testing', permissions: ['lab:manage'] },
    { name: 'Billing Officer', description: 'Patient billing and insurance', permissions: ['billing:manage', 'accounting:read'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Medicine Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Medical Supplies', type: 'ASSET', subType: 'Current Asset' },
    { code: '1003', name: 'Equipment & Machinery', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '2001', name: 'Accounts Payable - Suppliers', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Insurance Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Retained Earnings', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Consultation Revenue', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'IPD Revenue', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4003', name: 'Lab Test Revenue', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Medicine Cost', type: 'EXPENSE', subType: 'COGS' },
    { code: '5002', name: 'Staff Salary', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5003', name: 'Equipment Maintenance', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Medicines', description: 'Pharmaceutical drugs and medications' },
    { name: 'Surgical Supplies', description: 'Gloves, masks, sutures, etc.' },
    { name: 'Lab Reagents', description: 'Testing chemicals and reagents' },
    { name: 'Medical Equipment', description: 'Devices and instruments' },
    { name: 'Consumables', description: 'Disposable items and supplies' },
  ],
  approvalWorkflows: [
    { name: 'Medicine Procurement', module: 'purchase', steps: ['Pharmacist', 'Administration', 'Finance'] },
    { name: 'Equipment Purchase', module: 'purchase', steps: ['Department Head', 'Administration', 'Finance'] },
    { name: 'Patient Discount', module: 'sales', steps: ['Billing Officer', 'Administration'] },
  ],
  dashboardWidgets: [
    { title: 'Patient Admissions', type: 'metric', module: 'crm', size: 'sm' },
    { title: 'Bed Occupancy', type: 'chart', module: 'crm', size: 'md' },
    { title: 'Medicine Stock Alert', type: 'list', module: 'inventory', size: 'lg' },
    { title: 'Revenue Today', type: 'metric', module: 'accounting', size: 'sm' },
  ],
};
