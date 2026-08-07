'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Command, CornerDownLeft, Search, Settings, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useWorkspace } from '@/core/workspace/workspace-context';
import { useShellStore } from '@/core/layout/shell-store';
import { cn } from '@/lib/utils';
import type { QuickActionDef } from '@/core/workspace/types';

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  hint?: string;
  icon: React.ElementType;
  onSelect: () => void;
  kind: 'page' | 'action' | 'widget';
}

export function CommandPalette({ onCommand }: { onCommand?: (command: string) => void }) {
  const { open, setOpen } = usePalette();
  const { resolved } = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = [];
    for (const section of resolved.manifest.navigation) {
      for (const item of section.items) {
        pages.push({
          id: `page-${item.id}`,
          label: item.label,
          description: section.label,
          hint: 'Page',
          icon: item.icon,
          kind: 'page',
          onSelect: () => router.push(item.href),
        });
      }
    }
    const actions: PaletteItem[] = resolved.manifest.quickActions.map((a: QuickActionDef) => ({
      id: `action-${a.id}`,
      label: a.label,
      description: a.description,
      hint: a.shortcut ? `⌘ ${a.shortcut}` : 'Action',
      icon: a.icon,
      kind: 'action',
      onSelect: () => {
        if (a.href) router.push(a.href);
        else onCommand?.(a.command ?? a.id);
      },
    }));
    return [...pages, ...actions];
  }, [resolved, router, onCommand]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => setActive(0), [filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter' && filtered[active]) {
        filtered[active].onSelect();
        setOpen(false);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, setOpen]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, actions, anything..."
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="flex shrink-0 items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                  No results for &quot;{query}&quot;
                </p>
              )}
              {filtered.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-index={index}
                    onClick={() => {
                      item.onSelect();
                      setOpen(false);
                    }}
                    onMouseMove={() => setActive(index)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      index === active ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                        index === active
                          ? 'border-primary/20 bg-primary/10'
                          : 'border-border bg-slate-50 dark:bg-white/[0.04]',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{item.label}</span>
                      {item.description && (
                        <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      {item.hint}
                      {index === active && <CornerDownLeft className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> select</span>
              <span className="inline-flex items-center gap-1"><X className="h-3 w-3" /> close</span>
              <span className="ml-auto inline-flex items-center gap-1">
                <Settings className="h-3 w-3" /> {resolved.industryLabel} · {resolved.roleLabel}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function usePalette() {
  const paletteOpen = useShellStore((s) => s.paletteOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, setPaletteOpen]);
  return { open: paletteOpen, setOpen: setPaletteOpen };
}
