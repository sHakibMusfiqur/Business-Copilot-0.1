import type { IndustryTemplate, ProvisioningConfig } from './types';

export const garmentsTemplate: IndustryTemplate = {
  id: 'garments',
  name: 'Garments & Apparel',
  description: 'Apparel manufacturing, textile production, fashion design, and garment trading businesses',
  icon: 'shirt',
  color: '#6366f1',
  categories: [
    { id: 'garments-manufacturing', name: 'Manufacturing', description: 'Garment and textile manufacturing' },
    { id: 'garments-trading', name: 'Trading', description: 'Garment buying, selling, and export/import' },
    { id: 'garments-retail', name: 'Retail Store', description: 'Apparel retail and boutique operations' },
    { id: 'garments-tailoring', name: 'Tailoring', description: 'Custom tailoring and alteration services' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 10,
  estimatedMonthlyPrice: 99,
};

export const garmentsProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Production', description: 'Garment manufacturing and production floor' },
    { name: 'Design', description: 'Fashion design and product development' },
    { name: 'Merchandising', description: 'Buying, planning, and product allocation' },
    { name: 'Quality Control', description: 'Inspection and quality assurance' },
    { name: 'Warehouse', description: 'Raw materials and finished goods storage' },
    { name: 'Sales & Marketing', description: 'Sales, distribution, and brand marketing' },
    { name: 'Finance', description: 'Financial management and accounting' },
    { name: 'HR & Admin', description: 'Human resources and administration' },
  ],
  roles: [
    { name: 'Production Manager', description: 'Oversees manufacturing operations', permissions: ['production:manage', 'inventory:write'] },
    { name: 'Merchandiser', description: 'Manages orders and product planning', permissions: ['purchase:manage', 'sales:read'] },
    { name: 'Quality Inspector', description: 'Performs quality checks', permissions: ['quality:manage'] },
    { name: 'Store Keeper', description: 'Manages inventory and stock', permissions: ['inventory:manage'] },
    { name: 'Sales Executive', description: 'Handles sales and clients', permissions: ['sales:manage', 'crm:write'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Raw Materials Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Work in Progress', type: 'ASSET', subType: 'Current Asset' },
    { code: '1003', name: 'Finished Goods Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1004', name: 'Fabric & Trims Stock', type: 'ASSET', subType: 'Current Asset' },
    { code: '2001', name: 'Accounts Payable - Suppliers', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Wages Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Owner\'s Equity', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Sales Revenue - Garments', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'Export Revenue', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Raw Material Cost', type: 'EXPENSE', subType: 'COGS' },
    { code: '5002', name: 'Labor Cost', type: 'EXPENSE', subType: 'COGS' },
    { code: '5003', name: 'Manufacturing Overhead', type: 'EXPENSE', subType: 'COGS' },
    { code: '5004', name: 'Shipping & Freight', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Fabrics', description: 'Cotton, polyester, silk, denim, etc.' },
    { name: 'Trims & Accessories', description: 'Buttons, zippers, labels, threads, etc.' },
    { name: 'Raw Materials', description: 'Dyes, chemicals, packaging materials' },
    { name: 'Work in Progress', description: 'Semi-finished garments' },
    { name: 'Finished Goods', description: 'Ready-to-ship garments' },
    { name: 'Packing Materials', description: 'Poly bags, cartons, hangers' },
  ],
  approvalWorkflows: [
    { name: 'Purchase Order Approval', module: 'purchase', steps: ['Merchandiser', 'Production Manager', 'Finance'] },
    { name: 'Sample Approval', module: 'sales', steps: ['Designer', 'Merchandiser', 'Client'] },
    { name: 'Quality Check', module: 'inventory', steps: ['Quality Inspector', 'Production Manager'] },
  ],
  dashboardWidgets: [
    { title: 'Production Output', type: 'chart', module: 'inventory', size: 'md' },
    { title: 'Order Fulfillment', type: 'metric', module: 'sales', size: 'sm' },
    { title: 'Inventory Status', type: 'table', module: 'inventory', size: 'lg' },
    { title: 'Pending Approvals', type: 'list', module: 'purchase', size: 'sm' },
  ],
};
