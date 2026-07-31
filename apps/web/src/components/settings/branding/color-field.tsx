'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { HEX_RE } from '@/lib/validation';

interface ColorFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (hex: string) => void;
  presets?: string[];
}

export function ColorField({ label, description, value, onChange, presets = [] }: ColorFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const valid = HEX_RE.test(value);

  const commitHex = () => {
    setEditing(false);
    const hex = draft.trim();
    if (HEX_RE.test(hex)) {
      onChange(hex.toLowerCase());
    } else {
      setDraft(value);
    }
  };

  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-2 flex items-center gap-2">
        <div
          className={cn(
            'relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border shadow-sm transition-colors',
            valid ? 'border-border' : 'border-destructive',
          )}
        >
          <div className="h-full w-full" style={{ backgroundColor: valid ? value : 'transparent' }} />
          <input
            type="color"
            value={valid ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
        </div>

        {editing ? (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHex();
              if (e.key === 'Escape') { setEditing(false); setDraft(value); }
            }}
            autoFocus
            className={cn('h-9 w-28 font-mono text-xs', !HEX_RE.test(draft) && 'border-destructive')}
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(true); }}
            className={cn(
              'flex h-9 w-28 items-center rounded-lg border bg-background px-3 font-mono text-xs text-foreground transition-colors',
              valid ? 'border-border hover:border-primary/50' : 'border-destructive',
            )}
          >
            {value.toUpperCase()}
          </button>
        )}

        {presets.length > 0 && (
          <div className="ml-1 flex items-center gap-1.5">
            {presets.map((p) => {
              const active = value.toLowerCase() === p.toLowerCase();
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange(p)}
                  className={cn(
                    'relative h-6 w-6 rounded-full border border-border/60 transition-transform hover:scale-110',
                    active && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                  )}
                  style={{ backgroundColor: p }}
                  aria-label={`Use color ${p}`}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white drop-shadow" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
