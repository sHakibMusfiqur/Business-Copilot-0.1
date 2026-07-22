export const appConfig = {
  name: 'Business Copilot',
  version: '0.1.0',
  description: 'Enterprise ERP + AI Business Copilot Platform',
  defaultLocale: 'en-US',
  defaultTimezone: 'UTC',
  pagination: {
    defaultPageSize: 10,
    maxPageSize: 100,
  },
  upload: {
    maxFileSize: 10 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
} as const;

export const roles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER'] as const;

export const modules = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { key: 'customers', label: 'Customers', icon: 'Users' },
  { key: 'suppliers', label: 'Suppliers', icon: 'Building2' },
  { key: 'products', label: 'Products', icon: 'Package' },
  { key: 'inventory', label: 'Inventory', icon: 'Warehouse' },
  { key: 'sales', label: 'Sales', icon: 'ShoppingCart' },
  { key: 'invoices', label: 'Invoices', icon: 'Receipt' },
  { key: 'purchases', label: 'Purchases', icon: 'ShoppingBag' },
  { key: 'accounting', label: 'Accounting', icon: 'Calculator' },
  { key: 'employees', label: 'Employees', icon: 'Users2' },
  { key: 'payroll', label: 'Payroll', icon: 'Wallet' },
  { key: 'crm', label: 'CRM', icon: 'BarChart3' },
  { key: 'reports', label: 'Reports', icon: 'BarChart3' },
  { key: 'copilot', label: 'AI Copilot', icon: 'Bot' },
] as const;
