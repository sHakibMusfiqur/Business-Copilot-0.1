import type { IndustryTemplate, ProvisioningConfig } from './types';

export const retailTemplate: IndustryTemplate = {
  id: 'retail',
  name: 'Retail & E-Commerce',
  description: 'Retail stores, supermarkets, online shops, and multi-channel commerce',
  icon: 'shopping-bag',
  color: '#8b5cf6',
  categories: [
    { id: 'retail-supermarket', name: 'Supermarket', description: 'Grocery and general merchandise retail' },
    { id: 'retail-ecommerce', name: 'E-Commerce', description: 'Online store and digital commerce' },
    { id: 'retail-electronics', name: 'Electronics Store', description: 'Consumer electronics and gadgets' },
    { id: 'retail-fashion', name: 'Fashion Boutique', description: 'Clothing and accessories retail' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 6,
  estimatedMonthlyPrice: 69,
};

export const retailProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Store Operations', description: 'Day-to-day store management' },
    { name: 'Sales Floor', description: 'Customer service and sales' },
    { name: 'Warehouse', description: 'Stock receiving and storage' },
    { name: 'Marketing', description: 'Promotions and advertising' },
    { name: 'Finance', description: 'Accounting and financial management' },
    { name: 'HR', description: 'Staff management and payroll' },
  ],
  roles: [
    { name: 'Store Manager', description: 'Overall store management', permissions: ['all:manage'] },
    { name: 'Sales Associate', description: 'Customer assistance and sales', permissions: ['sales:write', 'crm:read'] },
    { name: 'Cashier', description: 'Point of sale operations', permissions: ['sales:write', 'accounting:read'] },
    { name: 'Inventory Clerk', description: 'Stock management', permissions: ['inventory:manage', 'purchase:read'] },
    { name: 'Marketing Coordinator', description: 'Promotions and campaigns', permissions: ['marketing:manage'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Merchandise Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Store Equipment', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '1003', name: 'Cash in Register', type: 'ASSET', subType: 'Current Asset' },
    { code: '2001', name: 'Supplier Payables', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Sales Tax Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Owner\'s Equity', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Product Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'Online Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: 'COGS' },
    { code: '5002', name: 'Staff Salaries', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5003', name: 'Store Rent', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Electronics', description: 'Gadgets, accessories, devices' },
    { name: 'Clothing', description: 'Apparel, shoes, accessories' },
    { name: 'Groceries', description: 'Food and beverage items' },
    { name: 'Home Goods', description: 'Household items and decor' },
    { name: 'Health & Beauty', description: 'Personal care and cosmetics' },
  ],
  approvalWorkflows: [
    { name: 'Supplier Purchase', module: 'purchase', steps: ['Inventory Clerk', 'Store Manager', 'Finance'] },
    { name: 'Price Adjustment', module: 'sales', steps: ['Store Manager'] },
    { name: 'Inventory Write-Off', module: 'inventory', steps: ['Inventory Clerk', 'Store Manager'] },
  ],
  dashboardWidgets: [
    { title: 'Today\'s Sales', type: 'metric', module: 'sales', size: 'sm' },
    { title: 'Top Selling Products', type: 'chart', module: 'sales', size: 'md' },
    { title: 'Stock Alerts', type: 'list', module: 'inventory', size: 'lg' },
    { title: 'Monthly Revenue', type: 'chart', module: 'accounting', size: 'md' },
  ],
};
