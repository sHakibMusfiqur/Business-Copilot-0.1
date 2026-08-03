'use client';

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, RefreshCw, X, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type BrandAssetVariant =
  | 'logo'
  | 'darkLogo'
  | 'favicon'
  | 'loginBackground'
  | 'loginIllustration'
  | 'documentLogo';

const ALLOWED_EXT: Record<BrandAssetVariant, string[]> = {
  logo: ['png', 'jpg', 'jpeg', 'svg'],
  darkLogo: ['png', 'jpg', 'jpeg', 'svg'],
  favicon: ['ico', 'png'],
  loginBackground: ['png', 'jpg', 'jpeg', 'webp'],
  loginIllustration: ['png', 'jpg', 'jpeg', 'svg', 'webp'],
  documentLogo: ['png', 'jpg', 'jpeg', 'svg'],
};

const EXT_LABEL: Record<BrandAssetVariant, string> = {
  logo: 'PNG, JPG, SVG',
  darkLogo: 'PNG, JPG, SVG',
  favicon: 'ICO, PNG',
  loginBackground: 'PNG, JPG, WEBP',
  loginIllustration: 'PNG, JPG, SVG, WEBP',
  documentLogo: 'PNG, JPG, SVG',
};

const MAX_SIZE = 2 * 1024 * 1024;

interface FileUploadProps {
  variant: BrandAssetVariant;
  preview: string | null;
  onChange: (file: File | null, preview: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}

export function FileUpload({ variant, preview, onChange, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = ALLOWED_EXT[variant];

  const validate = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowed.includes(ext)) {
      return `Unsupported file type. Please upload ${EXT_LABEL[variant]}.`;
    }
    if (file.size > MAX_SIZE) {
      return 'File is too large. Maximum size is 2MB.';
    }
    return null;
  };

  const readFile = (file: File) => {
    const err = validate(file);
    if (err) {
      setError(err);
      onChange(null, null);
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onChange(file, reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const isLogo = variant === 'logo' || variant === 'darkLogo' || variant === 'documentLogo';

  const assetLabel: Record<BrandAssetVariant, string> = {
    logo: 'logo',
    darkLogo: 'dark logo',
    favicon: 'favicon',
    loginBackground: 'login background',
    loginIllustration: 'login illustration',
    documentLogo: 'document logo',
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={allowed.map((e) => `.${e}`).join(',')}
        className="sr-only"
        disabled={disabled}
        onChange={handleInput}
      />

      {preview ? (
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              'flex shrink-0 items-center justify-center overflow-hidden border border-border bg-background/60 shadow-inner',
              isLogo ? 'h-24 w-24 rounded-2xl' : 'h-16 w-16 rounded-xl',
            )}
          >
            <div
              className={cn(
                'bg-contain bg-center bg-no-repeat',
                isLogo ? 'h-20 w-20' : 'h-12 w-12',
              )}
              style={{ backgroundImage: `url(${preview})` }}
            />
          </motion.div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(null, null)}
                disabled={disabled}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Max size 2MB · {EXT_LABEL[variant]}</p>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200',
            dragOver
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5',
          )}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0.7 }}
            animate={{ scale: dragOver ? 1.1 : 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/10"
          >
            <UploadCloud className="h-6 w-6 text-primary" />
          </motion.div>
          <p className="mt-3 text-sm font-medium text-foreground">
            Drag & drop your {assetLabel[variant]} here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or <span className="font-medium text-primary underline underline-offset-2">browse files</span>
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground/70">Max 2MB · {EXT_LABEL[variant]}</p>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1.5 text-xs text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
