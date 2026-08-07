'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Bot,
  ChevronDown,
  Command,
  Menu,
  Search,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useWorkspace } from '@/core/workspace/workspace-context';
import { INDUSTRY_ICONS } from '@/core/workspace/industries';
import { useShellStore } from '@/core/layout/shell-store';
import { brandInitials } from '@/lib/branding';
import { useBrandingStore } from '@/store/branding-store';

export function AppTopbar() {
  const { resolved } = useWorkspace();
  const setMobileOpen = useShellStore((s) => s.setMobileSidebarOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  const aiPanelOpen = useShellStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useShellStore((s) => s.setAiPanelOpen);
  const brand = useBrandingStore((s) => s.brand);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const IndustryIcon = INDUSTRY_ICONS[resolved.industry] ?? INDUSTRY_ICONS.general;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl dark:bg-background/80 lg:px-6">
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="rounded-[10px] p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Global search → command palette */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[12px] border border-border bg-slate-50/60 px-3 text-sm text-slate-400 transition-colors hover:border-slate-300 dark:bg-white/[0.04] dark:hover:border-white/[0.16] lg:max-w-md"
      >
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
            onClick={() => setWorkspaceOpen((v) => !v)}
            className="flex h-9 items-center gap-2 rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.06]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IndustryIcon className="h-3.5 w-3.5" />
            </span>
            <span className="max-w-[150px] truncate">{brand.brandName || 'Workspace'}</span>
            <ChevronDown className={cnRotate(workspaceOpen)} />
          </button>
          <AnimatePresence>
            {workspaceOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl dark:shadow-black/40"
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
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {resolved.industryLabel} · {resolved.roleLabel}
                    </p>
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Copilot toggle */}
        <button
          onClick={() => setAiPanelOpen(!aiPanelOpen)}
          aria-label="Open AI Copilot"
          className={`relative flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors ${
            aiPanelOpen
              ? 'bg-primary/10 text-primary'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-white'
          }`}
        >
          <Bot className="h-4 w-4" />
        </button>

        <ThemeToggle />

        <button aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-white">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>
      </div>
    </header>
  );
}

function cnRotate(open: boolean): string {
  return `h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${open ? 'rotate-180' : ''}`;
}
