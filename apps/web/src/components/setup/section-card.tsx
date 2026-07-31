'use client';

import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, description, icon, badge, children }: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200/60 bg-white/70 shadow-lg shadow-slate-200/40 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 dark:border-white/10">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
