'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface LostReasonDialogProps {
  open: boolean;
  dealTitle: string | null;
  stageName: string | null;
  isPending: boolean;
  onCancel: () => void;
  /** Called with the trimmed reason once the user confirms. */
  onConfirm: (reason: string) => void;
}

const MAX_REASON = 500;

/**
 * The backend requires a lostReason when a deal moves into a lost stage,
 * so dropping a deal on a lost column opens this prompt first.
 */
export function LostReasonDialog({ open, dealTitle, stageName, isPending, onCancel, onConfirm }: LostReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A reason is required to mark a deal as lost.');
      return;
    }
    if (trimmed.length > MAX_REASON) {
      setError(`Reason must be ${MAX_REASON} characters or fewer.`);
      return;
    }
    setError(null);
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Mark deal as lost">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={isPending ? undefined : onCancel} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <XCircle className="h-5 w-5 text-red-600" />
            Mark as Lost
          </h2>
          <button onClick={onCancel} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Moving <span className="font-medium text-foreground">{dealTitle}</span> to{' '}
          <span className="font-medium text-foreground">{stageName}</span> closes it as lost. A reason is required.
        </p>

        <Label htmlFor="lost-reason">Lost Reason *</Label>
        <textarea
          id="lost-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_REASON}
          placeholder="e.g. Chose a competitor, budget cut..."
          className="mt-1.5 flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-invalid={error ? true : undefined}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-destructive">{error ?? ''}</span>
          <span className="text-xs text-muted-foreground">
            {reason.length}/{MAX_REASON}
          </span>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} variant="destructive">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Moving...
              </>
            ) : (
              'Mark as Lost'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
