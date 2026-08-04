'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useWorkspace } from '@/lib/workspace/context';
import { useShellStore } from '@/lib/workspace/shell-store';
import { INDUSTRY_ICONS } from '@/lib/workspace/modules';
import { logout as apiLogout } from '@/lib/api';
import { brandInitials } from '@/lib/branding';
import { cn, generateInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useBrandingStore } from '@/store/branding-store';
import type { NavItem } from '@/lib/workspace/types';

export function AppSidebar() {
  const { resolved, isResolving } = useWorkspace();
  const collapsed = useShellStore((s) => s.sidebarCollapsed);
  const mobileOpen = useShellStore((s) => s.mobileSidebarOpen);
  const toggleSidebar = useShellStore((s) => s.toggleSidebar);
  const setMobileOpen = useShellStore((s) => s.setMobileSidebarOpen);
  const closeAll = useShellStore((s) => s.closeAll);

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const brand = useBrandingStore((s) => s.brand);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const IndustryIcon = INDUSTRY_ICONS[resolved.industry] ?? INDUSTRY_ICONS.general;

  async function handleLogout() {
    await apiLogout();
    logout();
    router.push('/login');
  }

  const favorites = resolved.manifest.navigation
    .flatMap((s) => s.items)
    .filter((i) => i.favorite || i.pinned);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-2xl transition-all duration-300 ease-out',
        collapsed ? 'w-[80px]' : 'w-[300px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      {/* Logo + collapse */}
      <div className={cn('flex h-14 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-0' : 'gap-2 px-4')}>
        <Link href="/dashboard" className={cn('flex min-w-0 items-center gap-2.5', collapsed ? 'shrink-0' : 'flex-1')}>
          {brand.logoUrl ? (
            <div className="brand-logo h-8 w-8 shrink-0 rounded-lg" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {brandInitials(brand.brandName)}
            </div>
          )}
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight">{brand.brandName}</span>
          )}
        </Link>
        <button
          onClick={() => {
            toggleSidebar();
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

      {/* Workspace switcher chip */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IndustryIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{brand.brandName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {resolved.industryLabel} · {resolved.roleLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-3 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {isResolving ? (
          <div className="space-y-2 px-2 pt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-8 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {favorites.length > 0 && (
              <div className="mb-4">
                {!collapsed && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    Favorites
                  </p>
                )}
                <div className="space-y-0.5">
                  {favorites.map((item) => (
                    <SidebarLink key={item.id} item={item} collapsed={collapsed} pathname={pathname} onNavigate={closeAll} />
                  ))}
                </div>
              </div>
            )}

            {resolved.manifest.navigation.map((section) => (
              <div key={section.id} className="mb-4">
                {!collapsed && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <SidebarLink key={item.id} item={item} collapsed={collapsed} pathname={pathname} onNavigate={closeAll} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
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

          <AnimatePresence>
            {userMenuOpen && !collapsed && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl dark:shadow-black/40"
              >
                <Link
                  href="/dashboard/settings"
                  onClick={() => { setUserMenuOpen(false); closeAll(); }}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ item, collapsed, pathname, onNavigate }: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  const isActive = pathname === item.href;
  const Icon: LucideIcon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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
      <Icon className={cn('h-4 w-4 shrink-0', collapsed ? 'mx-auto' : 'ml-3', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:text-slate-200 dark:shadow-black/40">
          {item.label}
        </div>
      )}
    </Link>
  );
}
