import type { IndustryTemplate, ProvisioningConfig } from './types';

export const pharmacyTemplate: IndustryTemplate = {
  id: 'pharmacy',
  name: 'Pharmacy & Drug Store',
  description: 'Retail pharmacies, drug stores, medicine wholesalers, and pharmaceutical distributors',
  icon: 'pill',
  color: '#22c55e',
  categories: [
    { id: 'pharmacy-retail', name: 'Retail Pharmacy', description: 'Community pharmacy and drug store' },
    { id: 'pharmacy-wholesale', name: 'Pharmaceutical Wholesale', description: 'Medicine distribution and wholesale' },
    { id: 'pharmacy-chain', name: 'Pharmacy Chain', description: 'Multi-location pharmacy network' },
    { id: 'pharmacy-compounding', name: 'Compounding Pharmacy', description: 'Custom medication preparation' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 5,
  estimatedMonthlyPrice: 89,
};

export const pharmacyProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Dispensing', description: 'Medicine dispensing and counseling' },
    { name: 'Inventory', description: 'Medicine stock management' },
    { name: 'Purchasing', description: 'Medicine procurement and vendor management' },
    { name: 'Finance', description: 'Billing, accounting, and insurance claims' },
    { name: 'Administration', description: 'Store administration and HR' },
  ],
  roles: [
    { name: 'Pharmacist', description: 'Licensed pharmacist', permissions: ['inventory:manage', 'sales:write', 'pharmacy:manage'] },
    { name: 'Pharmacy Technician', description: 'Dispensing support', permissions: ['inventory:read', 'sales:write'] },
    { name: 'Purchase Officer', description: 'Medicine procurement', permissions: ['purchase:manage', 'inventory:read'] },
    { name: 'Cashier', description: 'Billing and payment', permissions: ['accounting:write', 'sales:read'] },
    { name: 'Store Manager', description: 'Overall pharmacy management', permissions: ['all:manage'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Medicine Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Scheduled Drugs Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1003', name: 'Store Fixtures', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '2001', name: 'Supplier Payables', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Tax Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Owner\'s Capital', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Prescription Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'OTC Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Medicine Cost', type: 'EXPENSE', subType: 'COGS' },
    { code: '5002', name: 'Staff Salaries', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5003', name: 'Rent & Utilities', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Prescription Drugs', description: 'Schedule H, H1, G, and X drugs' },
    { name: 'OTC Medicines', description: 'Over-the-counter medications' },
    { name: 'Vitamins & Supplements', description: 'Health supplements and vitamins' },
    { name: 'Medical Devices', description: 'BP monitors, glucometers, etc.' },
    { name: 'Personal Care', description: 'Hygiene and personal care products' },
    { name: 'Surgical Items', description: 'Bandages, gloves, first aid' },
  ],
  approvalWorkflows: [
    { name: 'Medicine Purchase', module: 'purchase', steps: ['Pharmacist', 'Store Manager', 'Finance'] },
    { name: 'Expired Stock Write-Off', module: 'inventory', steps: ['Pharmacist', 'Store Manager'] },
    { name: 'Discount Approval', module: 'sales', steps: ['Pharmacist', 'Store Manager'] },
  ],
  dashboardWidgets: [
    { title: 'Today\'s Sales', type: 'metric', module: 'sales', size: 'sm' },
    { title: 'Expiring Stock', type: 'list', module: 'inventory', size: 'md' },
    { title: 'Low Stock Alert', type: 'table', module: 'inventory', size: 'lg' },
    { title: 'Revenue by Category', type: 'chart', module: 'accounting', size: 'md' },
  ],
};
