'use client';

import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { logout as apiLogout } from '@/lib/api';
import { cn, generateInitials } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuthStore } from '@/store/auth-store';
import { ADMIN_NAV } from './admin-nav';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));

  return (
    <div className="flex min-h-screen bg-muted/30">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border bg-card transition-[width] duration-200',
          collapsed ? 'w-14' : 'w-56',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="truncate text-[13px] font-semibold tracking-tight">
                Platform Console
              </span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {ADMIN_NAV.map((section) => (
            <div key={section.section} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.section}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {user?.name ? generateInitials(user.name) : 'SA'}
            </div>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-left">
                  {user?.name ?? 'Super Admin'}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </>
            )}
          </button>
          {profileOpen && !collapsed && (
            <div className="mt-1 rounded-md border border-border bg-popover p-1 shadow-lg">
              <Link
                href="/admin/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-popover-foreground hover:bg-muted"
              >
                Profile
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-popover-foreground hover:bg-muted"
              >
                Company Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className={cn('flex min-w-0 flex-1 flex-col transition-[margin] duration-200', collapsed ? 'lg:ml-14' : 'lg:ml-56')}>
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="hidden flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[13px] text-muted-foreground sm:flex sm:max-w-sm">
            <Search className="h-3.5 w-3.5" />
            <span>Search platform…</span>
            <kbd className="ml-auto rounded border border-border bg-background px-1 text-[10px]">⌘K</kbd>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/dashboard"
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
            >
              Company Dashboard
            </Link>
            <Link
              href="/admin/notifications"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>

        <footer className="border-t border-border px-4 py-3">
          <p className="text-[11px] text-muted-foreground">
            Business Copilot · Platform Administration Console · Super Admin only
          </p>
        </footer>
      </div>
    </div>
  );
}
