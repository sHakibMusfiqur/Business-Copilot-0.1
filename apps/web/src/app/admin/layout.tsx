'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  UsersRound,
  History,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Sun,
  Menu,
  X,
  ChevronDown,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { logout as apiLogout } from '@/lib/api';
import { generateInitials } from '@/lib/utils';
import { AuthProvider } from '@/providers/auth-provider';
import { useAuthStore } from '@/store/auth-store';

const sidebarItems = [
  { section: 'Platform', items: [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  ]},
  { section: 'Management', items: [
    { label: 'Organizations', href: '/admin/organizations', icon: Building2 },
    { label: 'Users', href: '/admin/users', icon: UsersRound },
  ]},
  { section: 'Monitoring', items: [
    { label: 'Audit Logs', href: '/admin/audit', icon: History },
  ]},
  { section: 'Configuration', items: [
    { label: 'Settings', href: '/admin/settings', icon: Settings },
    { label: 'Plans', href: '/admin/plans', icon: CreditCard },
  ]},
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    await apiLogout();
    queryClient.clear();
    logout();
    router.replace('/login');
  }

  return (
    <AuthProvider>
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
                <Link href="/admin" className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive">
                    <Shield className="h-4 w-4 text-destructive-foreground" />
                  </div>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-semibold text-sidebar-foreground"
                    >
                      Admin Panel
                    </motion.span>
                  )}
                </Link>
                <button
                  onClick={() => {
                    setCollapsed(!collapsed);
                    setMobileOpen(false);
                  }}
                  className="hidden rounded-lg p-1.5 text-sidebar-muted hover:bg-sidebar-accent lg:block"
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-sidebar-muted hover:bg-sidebar-accent lg:hidden"
                  aria-label="Close mobile menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3">
                {sidebarItems.map((section) => (
                  <div key={section.section} className="mb-4">
                    {!collapsed && (
                      <p className="mb-2 px-3 text-xs font-medium text-sidebar-muted">
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
                          className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'
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

              <div className="border-t border-sidebar-border p-3">
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-xs font-medium text-destructive">
                      {user?.name ? generateInitials(user.name) : 'SA'}
                    </div>
                    {!collapsed && (
                      <>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-sidebar-foreground truncate">
                            {user?.name ?? 'Admin'}
                          </p>
                          <p className="text-xs text-sidebar-muted truncate">
                            {user?.email ?? ''}
                          </p>
                        </div>
                        <ChevronDown className={`h-3 w-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>

                  {userMenuOpen && !collapsed && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border bg-popover p-1 shadow-lg">
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-accent"
                      >
                        <Building2 className="h-4 w-4" />
                        Switch to Dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
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
              <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-xl px-4 lg:px-8">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
                  aria-label="Open mobile menu"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="flex flex-1 items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground lg:max-w-md"
                >
                  <Search className="h-4 w-4" />
                  <span>Search platform...</span>
                  <kbd className="ml-auto hidden rounded border bg-background px-1.5 text-xs lg:inline">
                    Ctrl+K
                  </kbd>
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <Link
                    href="/dashboard"
                    className="hidden rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors sm:inline-flex items-center gap-1.5"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Dashboard
                  </Link>
                  <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </button>
                  <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" aria-label="Toggle theme">
                    <Sun className="h-4 w-4" />
                  </button>
                </div>
              </header>

              <div className="p-4 lg:p-8">
                {children}
              </div>
            </main>
      </div>
    </AuthProvider>
  );
}
