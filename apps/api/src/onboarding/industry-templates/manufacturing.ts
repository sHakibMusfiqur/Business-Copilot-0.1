import type { IndustryTemplate, ProvisioningConfig } from './types';

export const manufacturingTemplate: IndustryTemplate = {
  id: 'manufacturing',
  name: 'Manufacturing & Production',
  description: 'General manufacturing, industrial production, fabrication, and assembly operations',
  icon: 'factory',
  color: '#3b82f6',
  categories: [
    { id: 'mfg-general', name: 'General Manufacturing', description: 'Multi-product manufacturing' },
    { id: 'mfg-electronics', name: 'Electronics Manufacturing', description: 'PCB, device, and component assembly' },
    { id: 'mfg-food', name: 'Food Processing', description: 'Food and beverage processing' },
    { id: 'mfg-furniture', name: 'Furniture Manufacturing', description: 'Woodworking and furniture production' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 12,
  estimatedMonthlyPrice: 149,
};

export const manufacturingProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Production', description: 'Manufacturing and assembly lines' },
    { name: 'Quality Assurance', description: 'Product quality and testing' },
    { name: 'Raw Material Store', description: 'Raw materials and input storage' },
    { name: 'Finished Goods', description: 'Finished product storage' },
    { name: 'Engineering', description: 'Product design and process engineering' },
    { name: 'Procurement', description: 'Material sourcing and purchasing' },
    { name: 'Finance', description: 'Costing, accounting, and finance' },
    { name: 'HR & Admin', description: 'Human resources and administration' },
  ],
  roles: [
    { name: 'Production Supervisor', description: 'Oversees production lines', permissions: ['production:manage', 'inventory:read'] },
    { name: 'Quality Inspector', description: 'Quality checks and testing', permissions: ['quality:manage'] },
    { name: 'Store Keeper', description: 'Material and inventory management', permissions: ['inventory:manage', 'purchase:read'] },
    { name: 'Maintenance Engineer', description: 'Equipment maintenance', permissions: ['maintenance:manage'] },
    { name: 'Procurement Officer', description: 'Vendor management and purchasing', permissions: ['purchase:manage'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Raw Material Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Work in Progress', type: 'ASSET', subType: 'Current Asset' },
    { code: '1003', name: 'Finished Goods', type: 'ASSET', subType: 'Current Asset' },
    { code: '1004', name: 'Machinery & Equipment', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '2001', name: 'Supplier Payables', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Wages Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Share Capital', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Product Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'By-Product Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Raw Material Cost', type: 'EXPENSE', subType: 'COGS' },
    { code: '5002', name: 'Direct Labor', type: 'EXPENSE', subType: 'COGS' },
    { code: '5003', name: 'Manufacturing Overhead', type: 'EXPENSE', subType: 'COGS' },
    { code: '5004', name: 'Machine Maintenance', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Raw Materials', description: 'Input materials for production' },
    { name: 'Components', description: 'Sub-assemblies and parts' },
    { name: 'Packaging', description: 'Boxes, labels, wrapping materials' },
    { name: 'Work in Progress', description: 'Semi-finished products' },
    { name: 'Finished Goods', description: 'Ready-to-ship products' },
    { name: 'Spare Parts', description: 'Machine spare parts and tools' },
  ],
  approvalWorkflows: [
    { name: 'Material Purchase', module: 'purchase', steps: ['Store Keeper', 'Production Supervisor', 'Procurement Officer'] },
    { name: 'Production Plan', module: 'inventory', steps: ['Production Supervisor', 'Engineering'] },
    { name: 'Quality Hold Release', module: 'inventory', steps: ['Quality Inspector', 'Production Supervisor'] },
  ],
  dashboardWidgets: [
    { title: 'Production Output', type: 'chart', module: 'inventory', size: 'md' },
    { title: 'Machine Utilization', type: 'chart', module: 'inventory', size: 'md' },
    { title: 'Material Stock Level', type: 'table', module: 'inventory', size: 'lg' },
    { title: 'Order Backlog', type: 'list', module: 'sales', size: 'sm' },
  ],
};
