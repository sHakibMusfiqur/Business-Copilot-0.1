import type { IndustryTemplate, ProvisioningConfig } from './types';

export const itServicesTemplate: IndustryTemplate = {
  id: 'it-services',
  name: 'IT & Software Services',
  description: 'Software development, IT consulting, SaaS companies, and technology service providers',
  icon: 'laptop',
  color: '#06b6d4',
  categories: [
    { id: 'it-software', name: 'Software Development', description: 'Custom software and app development' },
    { id: 'it-consulting', name: 'IT Consulting', description: 'Technology consulting and advisory' },
    { id: 'it-saas', name: 'SaaS Company', description: 'Software-as-a-service product company' },
    { id: 'it-support', name: 'IT Support Services', description: 'Managed IT and support services' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 20,
  estimatedMonthlyPrice: 179,
};

export const itServicesProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Engineering', description: 'Software development and engineering' },
    { name: 'QA & Testing', description: 'Quality assurance and testing' },
    { name: 'Product Management', description: 'Product strategy and roadmap' },
    { name: 'Sales & Business Development', description: 'Client acquisition and sales' },
    { name: 'Customer Success', description: 'Client support and success' },
    { name: 'Finance', description: 'Accounting and financial management' },
    { name: 'HR & Admin', description: 'Human resources and administration' },
    { name: 'Infrastructure', description: 'Cloud and IT infrastructure' },
  ],
  roles: [
    { name: 'Software Engineer', description: 'Software development', permissions: ['projects:read', 'tasks:write'] },
    { name: 'QA Engineer', description: 'Testing and quality', permissions: ['quality:manage'] },
    { name: 'Project Manager', description: 'Project and client management', permissions: ['projects:manage', 'crm:read'] },
    { name: 'Sales Executive', description: 'Business development', permissions: ['crm:manage', 'sales:write'] },
    { name: 'DevOps Engineer', description: 'Infrastructure management', permissions: ['infra:manage'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Cash & Bank', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Accounts Receivable', type: 'ASSET', subType: 'Current Asset' },
    { code: '1003', name: 'Software Licenses', type: 'ASSET', subType: 'Intangible Asset' },
    { code: '1004', name: 'IT Equipment', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '2001', name: 'Salaries Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Deferred Revenue', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Retained Earnings', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Project Revenue', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'Support Revenue', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Employee Salaries', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5002', name: 'Cloud Infrastructure', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5003', name: 'Software Subscriptions', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5004', name: 'Office Rent', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Hardware', description: 'Servers, laptops, networking equipment' },
    { name: 'Software Licenses', description: 'Third-party software licenses' },
    { name: 'Office Supplies', description: 'Stationery and office consumables' },
  ],
  approvalWorkflows: [
    { name: 'Software Purchase', module: 'purchase', steps: ['Tech Lead', 'Finance'] },
    { name: 'Client Discount', module: 'sales', steps: ['Project Manager', 'Sales Director'] },
    { name: 'Hardware Procurement', module: 'purchase', steps: ['DevOps', 'Finance'] },
  ],
  dashboardWidgets: [
    { title: 'Active Projects', type: 'metric', module: 'crm', size: 'sm' },
    { title: 'Project Revenue', type: 'chart', module: 'accounting', size: 'md' },
    { title: 'Team Utilization', type: 'chart', module: 'hr', size: 'md' },
    { title: 'Upcoming Milestones', type: 'list', module: 'crm', size: 'sm' },
  ],
};
