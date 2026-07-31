'use client';

import { useState, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Search, Bell,
  Mail, PanelsTopLeft, PanelTop, LogIn, Inbox,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BrandingTheme } from '@/lib/branding';

export type BrandValues = BrandingTheme;

const TABS = [
  { id: 'sidebar', label: 'Sidebar', icon: PanelsTopLeft },
  { id: 'navbar', label: 'Navbar', icon: PanelTop },
  { id: 'login', label: 'Login', icon: LogIn },
  { id: 'email', label: 'Email', icon: Inbox },
] as const;

type TabId = (typeof TABS)[number]['id'];

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Users, label: 'Customers' },
  { icon: Package, label: 'Products' },
  { icon: ShoppingCart, label: 'Sales' },
];

function BrandMark({ brand, size = 'md' }: { brand: BrandValues; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-4 w-4 rounded' : 'h-5 w-5 rounded-md';
  const initials = (brand.brandName.trim().slice(0, 2) || 'BC').toUpperCase();
  if (brand.logoUrl) {
    return (
      <div
        className={cn(dims, 'shrink-0 bg-contain bg-center bg-no-repeat')}
        style={{ backgroundImage: `url(${brand.logoUrl})` }}
      />
    );
  }
  return (
    <div
      className={cn(dims, 'flex shrink-0 items-center justify-center text-[10px] font-bold text-white')}
      style={{ backgroundColor: brand.primaryColor }}
    >
      {initials}
    </div>
  );
}

function SidebarPreview({ brand }: { brand: BrandValues }) {
  return (
    <div className="flex h-56 overflow-hidden rounded-xl border border-border bg-card shadow-inner">
      <div className="flex w-1/3 flex-col border-r border-border bg-background p-2.5">
        <div className="flex items-center gap-1.5 px-0.5 pb-2.5">
          <BrandMark brand={brand} size="sm" />
          <span className="truncate text-[10px] font-semibold text-foreground">{brand.brandName || 'Company'}</span>
        </div>
        <div className="space-y-1">
          {NAV_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[8px]',
                i === 0 ? 'font-medium' : 'text-muted-foreground',
              )}
              style={i === 0 ? { backgroundColor: `${brand.primaryColor}1f`, color: brand.primaryColor } : undefined}
            >
              <item.icon className="h-2.5 w-2.5" />
              {item.label}
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[8px] text-muted-foreground">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: brand.accentColor }} />
          Online
        </div>
      </div>
      <div className="flex-1 space-y-2 p-3">
        <div className="h-2 w-2/3 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-2">
          <div
            className="h-9 rounded-lg"
            style={{ backgroundColor: `${brand.primaryColor}1a`, border: `1px solid ${brand.primaryColor}33` }}
          />
          <div className="h-9 rounded-lg bg-muted" />
          <div className="h-9 rounded-lg" style={{ backgroundColor: `${brand.accentColor}14` }} />
          <div className="h-9 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

function NavbarPreview({ brand }: { brand: BrandValues }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-inner">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <BrandMark brand={brand} size="sm" />
        <span className="text-[10px] font-semibold text-foreground">{brand.brandName || 'Company'}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[8px] text-muted-foreground">
            <Search className="h-2 w-2" /> Search...
          </div>
          <Bell className="h-2.5 w-2.5 text-muted-foreground" />
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: brand.secondaryColor }} />
        </div>
      </div>
      <div className="bg-background px-3 py-3">
        <div className="h-2 w-1/2 rounded bg-muted" />
        <div className="mt-2 flex gap-1.5">
          <span className="rounded px-1.5 py-0.5 text-[8px] font-medium text-white" style={{ backgroundColor: brand.primaryColor }}>
            Overview
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[8px] text-muted-foreground">Reports</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[8px] text-muted-foreground">Settings</span>
        </div>
      </div>
    </div>
  );
}

function LoginPreview({ brand }: { brand: BrandValues }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-inner">
      <div
        className="relative flex min-h-56 items-center justify-center p-5"
        style={{ background: `linear-gradient(135deg, ${brand.primaryColor} 0%, ${brand.secondaryColor} 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 30%, #fff 0, transparent 55%)' }}
        />
        <div className="relative w-full max-w-[210px] rounded-xl border border-white/25 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-center gap-1.5">
            <BrandMark brand={brand} size="sm" />
            <span className="text-[10px] font-semibold text-white">{brand.brandName || 'Company'}</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-3 rounded bg-white/25" />
            <div className="h-3 rounded bg-white/25" />
            <div
              className="mt-2 flex h-4 items-center justify-center rounded text-[8px] font-semibold text-white"
              style={{ backgroundColor: brand.accentColor }}
            >
              Sign In
            </div>
          </div>
          <p className="mt-2 truncate text-center text-[8px] text-white/70">{brand.tagline || 'Your workspace'}</p>
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ brand }: { brand: BrandValues }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-inner">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        <BrandMark brand={brand} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold text-foreground">{brand.brandName || 'Company'}</p>
          <p className="truncate text-[8px] text-muted-foreground">{brand.tagline || 'Welcome to your workspace'}</p>
        </div>
      </div>
      <div className="bg-background px-4 py-4">
        <div className="h-2 w-2/3 rounded" style={{ backgroundColor: brand.primaryColor }} />
        <div className="mt-2.5 space-y-1.5">
          <div className="h-1.5 rounded bg-muted" />
          <div className="h-1.5 w-5/6 rounded bg-muted" />
          <div className="h-1.5 w-4/6 rounded bg-muted" />
        </div>
        <div
          className="mt-3 inline-flex items-center gap-1 rounded px-2 py-1 text-[8px] font-medium text-white"
          style={{ backgroundColor: brand.primaryColor }}
        >
          <Mail className="h-2 w-2" /> Get Started
        </div>
        <div className="mt-3 border-t border-border pt-2 text-[8px] text-muted-foreground">
          © {new Date().getFullYear()} {brand.brandName || 'Company'}
        </div>
      </div>
    </div>
  );
}

const PREVIEWS: Record<TabId, ComponentType<{ brand: BrandValues }>> = {
  sidebar: SidebarPreview,
  navbar: NavbarPreview,
  login: LoginPreview,
  email: EmailPreview,
};

export function BrandPreview({ brand }: { brand: BrandValues }) {
  const [tab, setTab] = useState<TabId>('sidebar');
  const Preview = PREVIEWS[tab];

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors',
              tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            {tab === t.id && (
              <motion.span
                layoutId="preview-tab"
                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <t.icon className="relative h-3 w-3" />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Preview brand={brand} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
