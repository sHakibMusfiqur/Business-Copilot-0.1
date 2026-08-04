'use client';

import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AdminButton } from './admin-button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <AdminButton variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </AdminButton>
          <AdminButton variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
