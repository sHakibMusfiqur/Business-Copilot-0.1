'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  UsersRound,
  Building2,
  Package,
  Warehouse,
  ShoppingCart,
  Receipt,
  ShoppingBag,
  Calculator,
  Users2,
  Wallet,
  BarChart3,
  Bell,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Menu,
  X,
  ChevronDown,
  HelpCircle,
  Shield,
  BookOpen,
  FileText,
  BookOpenCheck,
  Scale,
  CreditCard,
  DollarSign,
  Contact,
  History,
  Command,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ThemeToggle } from '@/components/ui/theme-toggle';
import { usePermissions } from '@/hooks/use-permissions';
import { logout as apiLogout } from '@/lib/api';
import { brandInitials } from '@/lib/branding';
import { cn, generateInitials } from '@/lib/utils';
import { AuthProvider } from '@/providers/auth-provider';
import { OrganizationThemeProvider } from '@/providers/organization-theme-provider';
import { useAuthStore } from '@/store/auth-store';
import { useBrandingStore } from '@/store/branding-store';

interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
}

interface SidebarSection {
  section: string;
  items: SidebarItem[];
}

const sidebarItems: SidebarSection[] = [
  { section: 'Main', items: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
  ]},
  { section: 'Management', items: [
    { label: 'Customers', href: '/customers', icon: UsersRound, permission: 'customers.read' },
    { label: 'Suppliers', href: '/suppliers', icon: Building2, permission: 'suppliers.read' },
    { label: 'Products', href: '/products', icon: Package, permission: 'products.read' },
    { label: 'Inventory', href: '/inventory', icon: Warehouse, permission: 'inventory.read' },
    { label: 'Employees', href: '/employees', icon: Users2, permission: 'employees.read' },
  ]},
  { section: 'CRM', items: [
    { label: 'CRM Dashboard', href: '/crm', icon: Contact, permission: 'crm.read' },
    { label: 'Leads', href: '/crm/leads', icon: Users2, permission: 'crm.read' },
  ]},
  { section: 'Sales', items: [
    { label: 'Sales Orders', href: '/sales', icon: ShoppingCart, permission: 'sales.read' },
    { label: 'Invoices', href: '/invoices', icon: Receipt, permission: 'invoices.read' },
    { label: 'Purchases', href: '/purchases', icon: ShoppingBag, permission: 'purchase.read' },
  ]},
  { section: 'Finance', items: [
    { label: 'Accounting', href: '/accounting', icon: Calculator, permission: 'accounting.read' },
    { label: 'Chart of Accounts', href: '/accounting/accounts', icon: BookOpen, permission: 'accounting.accounts.read' },
    { label: 'Journal Entries', href: '/accounting/journal', icon: FileText, permission: 'accounting.journal.read' },
    { label: 'General Ledger', href: '/accounting/ledger', icon: BookOpenCheck, permission: 'accounting.journal.read' },
    { label: 'Trial Balance', href: '/accounting/trial-balance', icon: Scale, permission: 'accounting.journal.read' },
    { label: 'Receivables', href: '/accounting/receivables', icon: Receipt, permission: 'accounting.receivables.read' },
    { label: 'Payables', href: '/accounting/payables', icon: CreditCard, permission: 'accounting.payables.read' },
    { label: 'Payments', href: '/accounting/payments', icon: DollarSign, permission: 'payments.read' },
    { label: 'Payroll', href: '/payroll', icon: Wallet, permission: 'payroll.read' },
  ]},
  { section: 'Settings', items: [
    { label: 'Users', href: '/users', icon: UsersRound, permission: 'users.read' },
    { label: 'Roles', href: '/roles', icon: Shield, permission: 'organization.manage' },
    { label: 'Audit Log', href: '/audit', icon: History, permission: 'audit.read' },
    { label: 'Billing & Subscription', href: '/billing', icon: CreditCard, permission: 'billing.read' },
    { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports.read' },
    { label: 'AI Copilot', href: '/copilot', icon: Bot, permission: 'ai.read' },
  ]},
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const brand = useBrandingStore((s) => s.brand);
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  const visibleSidebarItems = sidebarItems
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => permissionsLoading || !item.permission || hasPermission(item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);

  async function handleLogout() {
    await apiLogout();
    logout();
    router.push('/login');
  }

  return (
    <AuthProvider>
      <OrganizationThemeProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Ambient background glows */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[400px] w-[400px] rounded-full bg-slate-400/[0.05] dark:bg-white/[0.02] blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-slate-500/[0.04] dark:bg-white/[0.02] blur-[120px]" />
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60 lg:hidden"
            />
          )}
        </AnimatePresence>

        <aside
          className={`fixed left-0 top-0 z-50 flex h-full flex-col glass-sidebar transition-all duration-300 ${
            collapsed ? 'w-[80px]' : 'w-[240px]'
          } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          {/* Logo */}
          <div className={cn('flex h-14 items-center border-b border-border', collapsed ? 'justify-center gap-0 px-0' : 'gap-2 px-4')}>
            <Link href="/dashboard" className={cn('flex min-w-0 items-center gap-2.5', collapsed ? 'shrink-0' : 'flex-1')}>
              {brand.logoUrl ? (
                <div className="brand-logo h-8 w-8 shrink-0 rounded-lg bg-slate-100 dark:bg-white/[0.06]" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  {brandInitials(brand.brandName)}
                </div>
              )}
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="truncate text-[15px] font-semibold tracking-tight"
                >
                  {brand.brandName}
                </motion.span>
              )}
            </Link>
            <button
              onClick={() => {
                setCollapsed(!collapsed);
                setMobileOpen(false);
              }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-white lg:block"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-white lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
            {visibleSidebarItems.map((section) => (
              <div key={section.section} className="mb-4">
                {!collapsed && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    {section.section}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'group relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-colors duration-150 ease-out',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white',
                        )}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active"
                            className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                          />
                        )}
                        <item.icon className={cn('h-4 w-4 shrink-0', collapsed ? 'mx-auto' : 'ml-3', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors')} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {collapsed && (
                          <div className="pointer-events-none absolute left-full ml-2 z-50 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:text-slate-200 dark:shadow-black/40 whitespace-nowrap">
                            {item.label}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User profile card */}
          <div className="border-t border-border p-3">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl border border-border bg-card p-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.06]',
                  collapsed && 'justify-center px-0',
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {user?.name ? generateInitials(user.name) : 'U'}
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-semibold">{user?.name ?? 'User'}</p>
                      <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{user?.email ?? ''}</p>
                    </div>
                    <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform dark:text-slate-500', userMenuOpen && 'rotate-180')} />
                  </>
                )}
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl dark:shadow-black/40">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className={cn('relative z-10 flex-1 transition-all duration-300', collapsed ? 'lg:ml-[80px]' : 'lg:ml-[240px]')}>
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-white/80 px-4 backdrop-blur-xl dark:bg-background/80 lg:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-[10px] p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Global search */}
            <button className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[12px] border border-border bg-slate-50/60 px-3 text-sm text-slate-400 transition-colors hover:border-slate-300 dark:bg-white/[0.04] dark:hover:border-white/[0.16] lg:max-w-md">
              <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate">Search anything...</span>
              <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-slate-400 lg:inline-flex">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-1">
              {/* Workspace switcher */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setWorkspaceOpen(!workspaceOpen)}
                  className="flex h-9 items-center gap-2 rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="max-w-[140px] truncate">{brand.brandName || 'Workspace'}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform dark:text-slate-500', workspaceOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {workspaceOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl dark:shadow-black/40"
                    >
                      <div className="px-3 pb-1.5 pt-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Workspace</p>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                          {brandInitials(brand.brandName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{brand.brandName}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">Current workspace</p>
                        </div>
                        <Sparkles className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button aria-label="Help" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-white">
                <HelpCircle className="h-4 w-4" />
              </button>

              <ThemeToggle />

              <button aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-white">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
              </button>
            </div>
          </header>

          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
      </OrganizationThemeProvider>
    </AuthProvider>
  );
}