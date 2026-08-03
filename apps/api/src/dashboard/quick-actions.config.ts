export interface QuickAction {
  label: string;
  href: string;
  icon: string;
  available: boolean;
  permission: string;
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Create Customer', href: '/dashboard/customers/new', icon: 'Users', available: true, permission: 'customers.create' },
  { label: 'Create Product', href: '/dashboard/products/new', icon: 'Package', available: true, permission: 'products.create' },
  { label: 'Create Invoice', href: '/dashboard/invoices/new', icon: 'Receipt', available: true, permission: 'invoices.create' },
  { label: 'Purchase Order', href: '/dashboard/purchases/new', icon: 'ShoppingBag', available: true, permission: 'purchase.create' },
  { label: 'Invite User', href: '/dashboard/settings/team', icon: 'UserPlus', available: true, permission: 'users.create' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'Settings', available: true, permission: 'settings.manage' },
];
