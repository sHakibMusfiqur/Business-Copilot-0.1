'use client';

import { motion } from 'framer-motion';
import { ChevronRight, Loader2, Check } from 'lucide-react';
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
}: SetupPageShellProps) {
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
              <Link href={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-6 space-y-6">
          {children}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button onClick={onSave} disabled={saving || saved}>
          {saving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : saved ? (
            <><Check className="mr-2 h-4 w-4" /> Saved</>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
