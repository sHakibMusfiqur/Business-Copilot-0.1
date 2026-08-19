'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Download,
  Mail,
  Palette,
  Percent,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

const SETTINGS_GROUPS: {
  title: string;
  items: { href: string; label: string; description: string; icon: LucideIcon }[];
}[] = [
  {
    title: 'Appearance',
    items: [
      { href: '/settings/branding', label: 'Branding', description: 'Logo, colors and login screen.', icon: Palette },
      { href: '/settings/preferences', label: 'Preferences', description: 'Language, format and defaults.', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'Communication',
    items: [
      { href: '/settings/notifications', label: 'Notifications', description: 'Choose what you get notified about.', icon: Bell },
      { href: '/settings/email', label: 'Email', description: 'Sender identity and templates.', icon: Mail },
    ],
  },
  {
    title: 'Finance & Compliance',
    items: [
      { href: '/settings/tax', label: 'Tax', description: 'Rates and registration details.', icon: Percent },
      { href: '/settings/billing', label: 'Billing & Plan', description: 'Subscription and payment method.', icon: CreditCard },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/settings/roles', label: 'Roles & Access', description: 'Permissions across your workspace.', icon: Shield },
      { href: '/settings/import', label: 'Data Import', description: 'Bring your existing data in.', icon: Download },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Settings</span>
        </nav>

        <div className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure how your workspace looks, communicates and runs.
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.title} className="space-y-3">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              {group.title}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3.5 rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm shadow-slate-200/40 backdrop-blur-xl transition-colors hover:border-primary/40 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20 dark:hover:bg-white/[0.07]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}