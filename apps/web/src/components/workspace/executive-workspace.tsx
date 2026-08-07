'use client';

import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';

import { AlertsBanner } from '@/components/workspace/widgets';
import { DashboardWidgetSurface } from '@/components/workspace/widget-registry';
import type { DashboardOverview } from '@/components/dashboard/types';
import { useDashboard } from '@/hooks/use-dashboard';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { spanTokens } from '@/core/dashboard/widget-layout';
import { useWorkspace } from '@/core/workspace/workspace-context';
import type { DashboardWidget } from '@/core/dashboard/widget-types';

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
 * Dumb renderer over the Dashboard Engine output. All widget selection,
 * ordering, visibility and layout are resolved by the engine; this component
 * only maps the resolved manifest to the rendering layer.
 */
export function ExecutiveWorkspace({ overview, onCommand }: ExecutiveWorkspaceProps) {
  const { manifest, context } = useDashboard();
  const { resolved } = useWorkspace();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0];
  const manifestData = resolved.manifest;

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
              {context.headline}
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
              {context.industryLabel} · {context.roleLabel}
            </span>
          </div>
        </div>
        <AlertsBanner overview={overview} />
      </div>

      {/* Engine-resolved widget zones */}
      {manifest.layout.zones.map((zone) => (
        <section key={zone.zone} className="grid grid-cols-12 gap-5">
          {zone.widgets.map((widget, index) => (
            <motion.div
              key={widget.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.025, ease: 'easeOut' }}
              className={cn('min-w-0', spanTokens(widget.span))}
            >
              <DashboardWidgetSurface widget={widget} overview={overview} manifest={manifestData} onCommand={onCommand} />
            </motion.div>
          ))}
        </section>
      ))}
    </motion.div>
  );
}

export type { DashboardWidget };