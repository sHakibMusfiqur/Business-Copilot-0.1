import type { IndustryTemplate, ProvisioningConfig } from './types';

export const restaurantTemplate: IndustryTemplate = {
  id: 'restaurant',
  name: 'Restaurant & Food Service',
  description: 'Restaurants, cafes, fast food chains, catering services, and food businesses',
  icon: 'utensils',
  color: '#f97316',
  categories: [
    { id: 'restaurant-full', name: 'Full Service Restaurant', description: 'Sit-down dining with table service' },
    { id: 'restaurant-fast', name: 'Fast Food / Quick Service', description: 'Quick service and takeaway' },
    { id: 'restaurant-cafe', name: 'Cafe & Bakery', description: 'Coffee shop, bakery, and pastry' },
    { id: 'restaurant-catering', name: 'Catering Service', description: 'Event and corporate catering' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 8,
  estimatedMonthlyPrice: 79,
};

export const restaurantProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Kitchen', description: 'Food preparation and cooking' },
    { name: 'Service', description: 'Waitstaff and front-of-house' },
    { name: 'Bar', description: 'Beverage preparation and service' },
    { name: 'Inventory', description: 'Food and supply storage' },
    { name: 'Finance', description: 'Billing, accounting, and payroll' },
    { name: 'Marketing', description: 'Promotions and customer engagement' },
    { name: 'HR', description: 'Staff management and scheduling' },
  ],
  roles: [
    { name: 'Chef', description: 'Head of kitchen operations', permissions: ['inventory:read', 'kitchen:manage'] },
    { name: 'Server', description: 'Customer service and order taking', permissions: ['sales:write', 'crm:read'] },
    { name: 'Store Keeper', description: 'Inventory and supplies management', permissions: ['inventory:manage', 'purchase:read'] },
    { name: 'Cashier', description: 'Billing and payments', permissions: ['accounting:write', 'sales:read'] },
    { name: 'Restaurant Manager', description: 'Overall restaurant operations', permissions: ['all:manage'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Food Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Beverage Inventory', type: 'ASSET', subType: 'Current Asset' },
    { code: '1003', name: 'Kitchen Equipment', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '2001', name: 'Supplier Payables', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Staff Wages Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Owner\'s Capital', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Food Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'Beverage Sales', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4003', name: 'Catering Revenue', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Food Cost', type: 'EXPENSE', subType: 'COGS' },
    { code: '5002', name: 'Beverage Cost', type: 'EXPENSE', subType: 'COGS' },
    { code: '5003', name: 'Staff Wages', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5004', name: 'Rent & Utilities', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Produce', description: 'Fresh fruits, vegetables, herbs' },
    { name: 'Meat & Seafood', description: 'Meat, poultry, fish, seafood' },
    { name: 'Dairy', description: 'Milk, cheese, butter, cream, eggs' },
    { name: 'Dry Goods', description: 'Rice, pasta, flour, spices, oils' },
    { name: 'Beverages', description: 'Soft drinks, juices, alcohol' },
    { name: 'Disposables', description: 'Napkins, takeaway containers, straws' },
  ],
  approvalWorkflows: [
    { name: 'Supplier Order', module: 'purchase', steps: ['Store Keeper', 'Chef', 'Restaurant Manager'] },
    { name: 'Menu Price Change', module: 'sales', steps: ['Chef', 'Restaurant Manager'] },
    { name: 'Inventory Write-Off', module: 'inventory', steps: ['Store Keeper', 'Restaurant Manager'] },
  ],
  dashboardWidgets: [
    { title: 'Daily Sales', type: 'metric', module: 'sales', size: 'sm' },
    { title: 'Popular Items', type: 'chart', module: 'sales', size: 'md' },
    { title: 'Inventory Low Stock', type: 'list', module: 'inventory', size: 'lg' },
    { title: 'Labor Cost %', type: 'metric', module: 'hr', size: 'sm' },
  ],
};
