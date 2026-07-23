export interface QuickAction {
  label: string;
  href: string;
  icon: string;
  available: boolean;
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Create Customer', href: '/dashboard/customers/new', icon: 'Users', available: true },
  { label: 'Create Product', href: '/dashboard/products/new', icon: 'Package', available: true },
  { label: 'Create Invoice', href: '/dashboard/invoices/new', icon: 'Receipt', available: true },
  { label: 'Purchase Order', href: '/dashboard/purchases/new', icon: 'ShoppingBag', available: true },
  { label: 'Invite User', href: '/dashboard/settings/team', icon: 'UserPlus', available: true },
  { label: 'Settings', href: '/dashboard/settings', icon: 'Settings', available: true },
];
