'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronRight, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface SetupPageShellProps {
  title: string;
  description: string;
  breadcrumb: BreadcrumbItem[];
  children: ReactNode;
  onSave: () => void | Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
  saved?: boolean;
  dirty?: boolean;
  saveLabel?: string;
  hideSaveBar?: boolean;
}

export function SetupPageShell({
  title,
  description,
  breadcrumb,
  children,
  onSave,
  onCancel,
  saving = false,
  saved = false,
  dirty,
  saveLabel = 'Save Changes',
  hideSaveBar = false,
}: SetupPageShellProps) {
  const showDirtyBadge = dirty === true && !saving;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {breadcrumb.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <AnimatePresence>
          {showDirtyBadge && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Unsaved changes
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20">
        <div className="space-y-6">{children}</div>
      </div>

      {!hideSaveBar && (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200/60 bg-white/80 px-5 py-3.5 shadow-xl shadow-slate-300/30 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:shadow-black/40">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button onClick={onSave} disabled={saving || saved || dirty === false} className="min-w-[150px] gap-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : saved ? (
                <><Check className="h-4 w-4" /> Saved</>
              ) : (
                <><Save className="h-4 w-4" /> {saveLabel}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
