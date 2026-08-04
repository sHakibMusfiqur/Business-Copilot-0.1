'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bot,
  CalendarCheck,
  FileText,
  LineChart,
  PieChart,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';

import { usePermissions } from '@/hooks/use-permissions';
import { useWorkspace } from '@/lib/workspace/context';
import { useShellStore } from '@/lib/workspace/shell-store';

interface CopilotAction {
  id: string;
  label: string;
  icon: LucideIcon;
  command: string;
  permission?: string[];
}

const COPILOT_ACTIONS: CopilotAction[] = [
  { id: 'invoice', label: 'Create Invoice', icon: FileText, command: 'invoice.create', permission: ['invoices.create'] },
  { id: 'leave', label: 'Approve Leave', icon: CalendarCheck, command: 'leave.approve', permission: ['employees.approve'] },
  { id: 'report', label: 'Generate Report', icon: BarChart3, command: 'reports.generate', permission: ['reports.read'] },
  { id: 'expense', label: 'Analyze Expenses', icon: PieChart, command: 'reports.analyze', permission: ['accounting.read'] },
  { id: 'forecast', label: 'Forecast Sales', icon: LineChart, command: 'ai.forecast', permission: ['sales.read'] },
];

export function AiCopilotDock({ onCommand }: { onCommand?: (command: string) => void }) {
  const aiPanelOpen = useShellStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useShellStore((s) => s.setAiPanelOpen);
  const { permissions } = usePermissions();

  const actions = useMemo(
    () =>
      COPILOT_ACTIONS.filter((a) =>
        !a.permission || a.permission.some((p) => permissions.includes(p)),
      ),
    [permissions],
  );

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {aiPanelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:shadow-black/60"
            >
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight">Business Copilot</p>
                  <p className="text-[11px] text-muted-foreground">Context-aware assistant</p>
                </div>
                <button onClick={() => setAiPanelOpen(false)} aria-label="Close AI assistant" className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[52vh] overflow-y-auto p-3">
                <p className="rounded-xl border border-border/70 bg-slate-50/60 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                  I can run actions for you. Choose one below — it will open the
                  right workspace with your context pre-applied.
                </p>
                <div className="mt-3 space-y-1.5">
                  {actions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setAiPanelOpen(false);
                          onCommand?.(a.command);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[13px] font-medium text-slate-600 transition-colors hover:border-primary/30 hover:text-primary dark:text-slate-300"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {a.label}
                        <Zap className="ml-auto h-3.5 w-3.5 text-amber-500" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dock trigger */}
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setAiPanelOpen(!aiPanelOpen)}
          aria-label="Toggle AI Copilot"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-white shadow-[0_8px_24px_-8px_rgba(59,130,246,0.6)] transition-transform hover:scale-105"
        >
          {aiPanelOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </motion.button>
      </div>
    </>
  );
}

export function CopilotContextStrip() {
  const { resolved, aiEnabled } = useWorkspace();
  if (!aiEnabled) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
        <Sparkles className="h-3 w-3" />
        Copilot
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        {resolved.industryLabel}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        {resolved.roleLabel}
      </span>
    </div>
  );
}
