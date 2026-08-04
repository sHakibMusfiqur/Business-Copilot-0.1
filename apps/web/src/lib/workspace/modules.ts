import {
  LayoutDashboard,
  UsersRound,
  Building2,
  Package,
  Warehouse,
  ShoppingCart,
  ShoppingBag,
  Calculator,
  Users2,
  Wallet,
  BarChart3,
  Bot,
  Shield,
  History,
  CreditCard,
  BookOpen,
  Contact,
  FileText,
  Scale,
  Banknote,
  Stethoscope,
  GraduationCap,
  Factory,
  CookingPot,
  Store,
  Pill,
  Scissors,
  Laptop,
  Landmark,
  type LucideIcon,
} from 'lucide-react';

export interface ModuleDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Group / section in the sidebar. */
  group: string;
  href: string;
  /** Any of these permissions unlocks the module. */
  permission?: string[];
  /** Industry ids that emphasize this module. */
  industries?: string[];
}

export const MODULES: ModuleDef[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Workspace', href: '/dashboard', permission: ['dashboard.read'] },
  { id: 'customers', label: 'Customers', icon: UsersRound, group: 'Relations', href: '/customers', permission: ['customers.read'] },
  { id: 'suppliers', label: 'Suppliers', icon: Building2, group: 'Relations', href: '/suppliers', permission: ['suppliers.read'] },
  { id: 'crm', label: 'CRM & Leads', icon: Contact, group: 'Relations', href: '/crm', permission: ['crm.read'] },
  { id: 'products', label: 'Products', icon: Package, group: 'Operations', href: '/products', permission: ['products.read'] },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, group: 'Operations', href: '/inventory', permission: ['inventory.read'] },
  { id: 'sales', label: 'Sales Orders', icon: ShoppingCart, group: 'Operations', href: '/sales', permission: ['sales.read'] },
  { id: 'purchases', label: 'Purchases', icon: ShoppingBag, group: 'Operations', href: '/purchases', permission: ['purchase.read'] },
  { id: 'accounting', label: 'Accounting', icon: Calculator, group: 'Finance', href: '/accounting', permission: ['accounting.read'] },
  { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen, group: 'Finance', href: '/accounting/accounts', permission: ['accounting.accounts.read'] },
  { id: 'journal', label: 'Journal Entries', icon: FileText, group: 'Finance', href: '/accounting/journal', permission: ['accounting.journal.read'] },
  { id: 'ledger', label: 'General Ledger', icon: BookOpen, group: 'Finance', href: '/accounting/ledger', permission: ['accounting.journal.read'] },
  { id: 'trial', label: 'Trial Balance', icon: Scale, group: 'Finance', href: '/accounting/trial-balance', permission: ['accounting.journal.read'] },
  { id: 'receivables', label: 'Receivables', icon: Banknote, group: 'Finance', href: '/accounting/receivables', permission: ['accounting.receivables.read'] },
  { id: 'payables', label: 'Payables', icon: CreditCard, group: 'Finance', href: '/accounting/payables', permission: ['accounting.payables.read'] },
  { id: 'payments', label: 'Payments', icon: Banknote, group: 'Finance', href: '/accounting/payments', permission: ['payments.read'] },
  { id: 'employees', label: 'Employees', icon: Users2, group: 'People', href: '/users', permission: ['employees.read'] },
  { id: 'payroll', label: 'Payroll', icon: Wallet, group: 'People', href: '/users', permission: ['payroll.read'] },
  { id: 'roles', label: 'Roles & Access', icon: Shield, group: 'Administration', href: '/roles', permission: ['organization.manage'] },
  { id: 'users', label: 'Users', icon: UsersRound, group: 'Administration', href: '/users', permission: ['users.read'] },
  { id: 'audit', label: 'Audit Log', icon: History, group: 'Administration', href: '/audit', permission: ['audit.read'] },
  { id: 'billing', label: 'Billing & Plan', icon: CreditCard, group: 'Administration', href: '/billing', permission: ['billing.read'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, group: 'Analytics', href: '/dashboard', permission: ['reports.read'] },
  { id: 'ai', label: 'AI Copilot', icon: Bot, group: 'Analytics', href: '/dashboard', permission: ['ai.read'] },
];

export const MODULE_GROUPS = ['Workspace', 'Relations', 'Operations', 'Finance', 'People', 'Administration', 'Analytics'] as const;

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
);

export const INDUSTRY_MODULES: Record<string, string[]> = {
  restaurant: ['dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'accounting', 'payments', 'employees', 'payroll', 'roles', 'billing', 'ai'],
  hospital: ['dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'accounting', 'payments', 'employees', 'payroll', 'roles', 'billing', 'ai'],
  manufacturing: ['dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'accounting', 'payments', 'employees', 'payroll', 'roles', 'billing', 'ai'],
  school: ['dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'accounting', 'payments', 'employees', 'payroll', 'roles', 'billing', 'ai'],
  software: ['dashboard', 'customers', 'suppliers', 'crm', 'sales', 'purchases', 'accounting', 'payments', 'employees', 'payroll', 'roles', 'billing', 'ai'],
  retail: ['dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'accounting', 'payments', 'employees', 'payroll', 'roles', 'billing', 'ai'],
};

/** Industry → signature icon used in the workspace switcher. */
export const INDUSTRY_ICONS: Record<string, LucideIcon> = {
  restaurant: CookingPot,
  hospital: Stethoscope,
  manufacturing: Factory,
  school: GraduationCap,
  software: Laptop,
  retail: Store,
  pharmacy: Pill,
  garments: Scissors,
  'it-services': Laptop,
  general: Landmark,
};

export const INDUSTRY_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  hospital: 'Hospital & Care',
  manufacturing: 'Manufacturing',
  school: 'School & Education',
  software: 'Software Company',
  retail: 'Retail',
  pharmacy: 'Pharmacy',
  garments: 'Garments & Textile',
  'it-services': 'IT Services',
  general: 'Business',
};
