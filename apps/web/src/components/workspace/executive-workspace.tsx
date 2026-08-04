'use client';

import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';

import { AlertsBanner } from '@/components/workspace/widgets';
import { WidgetSurface } from '@/components/workspace/widget-registry';
import type { DashboardOverview } from '@/components/dashboard/types';
import { useWorkspace } from '@/lib/workspace/context';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { WidgetZone } from '@/lib/workspace/types';

const ZONE_ORDER: WidgetZone[] = ['hero', 'kpis', 'charts', 'insights', 'side', 'bottom'];

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

interface ExecutiveWorkspaceProps {
  overview: DashboardOverview | null;
  onCommand?: (command: string) => void;
}

/**
 * Composes the executive workspace from the resolved manifest: a dynamic grid
 * of widgets arranged by zone (hero → kpis → charts → insights → side → bottom)
 * on the 12-column layout grid.
 */
export function ExecutiveWorkspace({ overview, onCommand }: ExecutiveWorkspaceProps) {
  const { resolved, isResolving } = useWorkspace();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0];

  if (isResolving) {
    return (
      <div className="space-y-5">
        <div className="skeleton-shimmer h-16 w-1/3 rounded-xl" />
        <div className="grid grid-cols-12 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer col-span-3 h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { manifest } = resolved;
  const zones = ZONE_ORDER.map((zone) => ({
    zone,
    widgets: manifest.widgets.filter((w) => w.zone === zone),
  })).filter((z) => z.widgets.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Executive header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight sm:text-[26px]">
              {manifest.headline}
            </h1>
            {firstName && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {firstName}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              {getFormattedDate()}
            </span>
            <span className="hidden h-3.5 w-px bg-slate-200 dark:bg-white/10 sm:block" />
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {resolved.industryLabel} · {resolved.roleLabel}
            </span>
          </div>
        </div>
        <AlertsBanner overview={overview} />
      </div>

      {/* Widget zones */}
      {zones.map(({ zone, widgets }) => (
        <section key={zone} className="grid grid-cols-12 gap-5">
          {widgets.map((widget, index) => (
            <motion.div
              key={`${widget.source ?? widget.key}-${zone}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.025, ease: 'easeOut' }}
              className={cn('min-w-0', spanClass(widget.span))}
            >
              <WidgetSurface widget={widget} overview={overview} manifest={manifest} onCommand={onCommand} />
            </motion.div>
          ))}
        </section>
      ))}
    </motion.div>
  );
}

function spanClass(span: number): string {
  switch (span) {
    case 3: return 'col-span-12 sm:col-span-6 xl:col-span-3';
    case 4: return 'col-span-12 sm:col-span-6 xl:col-span-4';
    case 5: return 'col-span-12 sm:col-span-6 xl:col-span-5';
    case 6: return 'col-span-12 sm:col-span-6 xl:col-span-6';
    case 7: return 'col-span-12 sm:col-span-6 xl:col-span-7';
    case 8: return 'col-span-12 sm:col-span-6 xl:col-span-8';
    default: return 'col-span-12';
  }
}
