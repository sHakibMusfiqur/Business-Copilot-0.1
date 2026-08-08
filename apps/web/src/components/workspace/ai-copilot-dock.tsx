'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bot,
  CalendarCheck,
  FileText,
  LineChart,
  PieChart,
  Send,
  Sparkles,
  X,
  Zap,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePermissions } from '@/hooks/use-permissions';
import { useWorkspace } from '@/core/workspace/workspace-context';
import { useShellStore } from '@/core/layout/shell-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  askCopilot,
  getCopilotStatus,
  type AiProviderStatus,
  type AiQueryData,
} from '@/lib/api/copilot';

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

type Role = 'user' | 'assistant';

interface ChatMessage {
  role: Role;
  content: string;
  data?: AiQueryData;
  unavailableCode?: string;
  model?: string;
}

function formatMoney(value: number | undefined, currency: string): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function AiCopilotDock({ onCommand }: { onCommand?: (command: string) => void }) {
  const aiPanelOpen = useShellStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useShellStore((s) => s.setAiPanelOpen);
  const { permissions } = usePermissions();

  const [status, setStatus] = useState<AiProviderStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aiPanelOpen) return;
    let active = true;
    getCopilotStatus()
      .then((s) => active && setStatus(s))
      .catch(() => active && setStatus(null));
    return () => {
      active = false;
    };
  }, [aiPanelOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const actions = useMemo(
    () =>
      COPILOT_ACTIONS.filter((a) =>
        !a.permission || a.permission.some((p) => permissions.includes(p)),
      ),
    [permissions],
  );

  const submit = useCallback(async () => {
    const query = input.trim();
    if (!query || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    try {
      const response = await askCopilot(query);
      const unavailable = response.unavailable;
      const answer = response.answer;
      if (unavailable) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: unavailable.message,
            data: response.data,
            unavailableCode: unavailable.code,
          },
        ]);
      } else if (answer) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: answer.text,
            data: response.data,
            model: answer.model,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'I could not answer that request. Please rephrase and try again.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong while contacting the assistant. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const showChat = status !== null || messages.length > 0 || loading;

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
              className="flex w-80 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:shadow-black/60"
            >
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight">Business Copilot</p>
                  <p className="text-[11px] text-muted-foreground">
                    {status?.configured ? 'Context-aware assistant' : 'Answers grounded in live data'}
                  </p>
                </div>
                <button onClick={() => setAiPanelOpen(false)} aria-label="Close AI assistant" className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!status?.configured && showChat && status !== null && (
                <div className="border-b border-amber-200/60 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  The Copilot LLM is not configured. Ask a question to see a live, data-backed
                  snapshot of your business.
                </div>
              )}

              <div className="max-h-[38vh] overflow-y-auto p-3" ref={scrollRef}>
                {messages.length === 0 && !loading ? (
                  <p className="rounded-xl border border-border/70 bg-slate-50/60 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                    Ask about sales, revenue, expenses, receivables, payables, inventory, customers,
                    suppliers or trends — I&apos;ll answer with your organization&apos;s real data.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {messages.map((msg, index) =>
                      msg.role === 'user' ? (
                        <div key={index} className="flex justify-end">
                          <div className="max-w-[85%] rounded-xl bg-primary/10 px-3 py-2 text-[12px] text-slate-700 dark:text-slate-200">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div key={index} className="flex justify-start">
                          <div className="w-full max-w-[92%] rounded-xl border border-border/70 bg-slate-50/60 px-3 py-2 text-[12px] leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.model && (
                              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {msg.model}
                              </p>
                            )}
                            {msg.data && <CopilotData data={msg.data} />}
                          </div>
                        </div>
                      ),
                    )}
                    {loading && (
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Copilot is working…
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                className="border-t border-border p-3"
              >
                <div className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your business…"
                    rows={2}
                    className="min-h-[60px] flex-1 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={loading || !input.trim()}
                    aria-label="Ask Copilot"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              <div className="max-h-[20vh] overflow-y-auto border-t border-border p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick actions
                </p>
                <div className="space-y-1.5">
                  {actions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setAiPanelOpen(false);
                          onCommand?.(a.command);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left text-[12px] font-medium text-slate-600 transition-colors hover:border-primary/30 hover:text-primary dark:text-slate-300"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {a.label}
                        <Zap className="ml-auto h-3.5 w-3.5 text-amber-500" />
                      </button>
                    );
                  })}
                  {actions.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      No quick actions available with your permissions.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

function CopilotData({ data }: { data: AiQueryData }) {
  if (!data.permitted) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] text-muted-foreground">
        You don&apos;t have permission to view this data.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/70 bg-card/60 p-2.5">
      {data.summaryLines && data.summaryLines.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
          {data.summaryLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {data.title}
            </span>
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {formatMoney(data.value, data.currency)}
            </span>
          </div>
          {data.points && data.points.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.points.map((p, i) => (
                <span
                  key={i}
                  className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300"
                >
                  {p.label}: {p.value.toLocaleString()}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {data.tables &&
        data.tables.map((table, i) => (
          <div key={i} className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border bg-slate-50/80 text-muted-foreground dark:bg-white/[0.03]">
                  {table.columns.map((col, j) => (
                    <th key={j} className="px-2 py-1 font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 4).map((row, r) => (
                  <tr key={r} className="border-b border-border/50 last:border-0">
                    <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{row.name}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {row.detail ?? row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
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