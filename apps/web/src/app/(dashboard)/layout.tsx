'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  UsersRound,
  Building2,
  ShoppingCart,
  Package,
  Warehouse,
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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { logout as apiLogout } from '@/lib/api';
import { brandInitials } from '@/lib/branding';
import { generateInitials } from '@/lib/utils';
import { AuthProvider } from '@/providers/auth-provider';
import { OrganizationThemeProvider } from '@/providers/organization-theme-provider';
import { useAuthStore } from '@/store/auth-store';
import { useBrandingStore } from '@/store/branding-store';


const sidebarItems = [
  { section: 'Main', items: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Management', items: [
    { label: 'Customers', href: '/customers', icon: UsersRound },
    { label: 'Suppliers', href: '/suppliers', icon: Building2 },
    { label: 'Products', href: '/products', icon: Package },
    { label: 'Inventory', href: '/inventory', icon: Warehouse },
  ]},
  { section: 'CRM', items: [
    { label: 'Dashboard', href: '/crm', icon: Contact },
    { label: 'Leads', href: '/crm/leads', icon: Users2 },
  ]},
  { section: 'Sales', items: [
    { label: 'Sales Orders', href: '/sales', icon: ShoppingCart },
    { label: 'Invoices', href: '/invoices', icon: Receipt },
    { label: 'Purchases', href: '/purchases', icon: ShoppingBag },
  ]},
  { section: 'Finance', items: [
    { label: 'Accounting', href: '/accounting', icon: Calculator },
    { label: 'Chart of Accounts', href: '/accounting/accounts', icon: BookOpen },
    { label: 'Journal Entries', href: '/accounting/journal', icon: FileText },
    { label: 'General Ledger', href: '/accounting/ledger', icon: BookOpenCheck },
    { label: 'Trial Balance', href: '/accounting/trial-balance', icon: Scale },
    { label: 'Receivables', href: '/accounting/receivables', icon: Receipt },
    { label: 'Payables', href: '/accounting/payables', icon: CreditCard },
    { label: 'Payments', href: '/accounting/payments', icon: DollarSign },
    { label: 'Payroll', href: '/payroll', icon: Wallet },
  ]},
  { section: 'People', items: [
    { label: 'Employees', href: '/employees', icon: Users2 },
  ]},
  { section: 'Administration', items: [
    { label: 'Users', href: '/users', icon: UsersRound },
    { label: 'Roles', href: '/roles', icon: Shield },
    { label: 'Audit Log', href: '/audit', icon: History },
  ]},
  { section: 'Intelligence', items: [
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'AI Copilot', href: '/copilot', icon: Bot },
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
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const brand = useBrandingStore((s) => s.brand);

  async function handleLogout() {
    await apiLogout();
    logout();
    router.push('/login');
  }

  return (
    <AuthProvider>
      <OrganizationThemeProvider>
      <div className="flex min-h-screen bg-background">
            <AnimatePresence>
              {mobileOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobileOpen(false)}
                  className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                />
              )}
            </AnimatePresence>

            <aside
              className={`fixed left-0 top-0 z-50 flex h-full flex-col glass-sidebar transition-all duration-300 ${
                collapsed ? 'w-[72px]' : 'w-[260px]'
              } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
              <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
                <Link href="/dashboard" className="flex items-center gap-3">
                    {brand.logoUrl ? (
                      <div
                        className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${brand.logoUrl})` }}
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
                        <span className="text-sm font-bold text-primary-foreground">{brandInitials(brand.brandName)}</span>
                      </div>
                    )}
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-bold text-slate-900"
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
                  className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:block"
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close sidebar"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3">
                {sidebarItems.map((section) => (
                  <div key={section.section} className="mb-4">
                    {!collapsed && (
                      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {section.section}
                      </p>
                    )}
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                            isActive
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && (
                            <span>{item.label}</span>
                          )}
                          {collapsed && (
                            <div className="absolute left-full ml-2 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 whitespace-nowrap">
                              {item.label}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              <div className="border-t border-slate-100 p-3">
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {user?.name ? generateInitials(user.name) : 'U'}
                    </div>
                    {!collapsed && (
                      <>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {user?.name ?? 'User'}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {user?.email ?? ''}
                          </p>
                        </div>
                        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>

                  {userMenuOpen && !collapsed && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg shadow-slate-200/50">
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <main className={`flex-1 transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
              <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-100 bg-white/80 backdrop-blur-xl px-4 lg:px-8">
                <button
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open menu"
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <button
                  className="flex flex-1 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-400 hover:border-slate-200 transition-colors lg:max-w-md"
                >
                  <Search className="h-4 w-4" />
                  <span>Search anything...</span>
                  <kbd className="ml-auto hidden rounded-lg border border-slate-100 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400 lg:inline">
                    Ctrl+K
                  </kbd>
                </button>

                <div className="flex items-center gap-1 ml-auto">
                  <button aria-label="Help" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  <button aria-label="Notifications" className="relative rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
                  </button>
                </div>
              </header>

              <div className="p-4 lg:p-8">
                {children}
              </div>
            </main>
          </div>
          </OrganizationThemeProvider>
        </AuthProvider>
  );
}
