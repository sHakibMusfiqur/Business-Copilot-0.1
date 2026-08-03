'use client';

import { type ReactNode } from 'react';

import { documentBrand } from '@/lib/branding';
import { useBrandingStore } from '@/store/branding-store';
import { cn } from '@/lib/utils';

interface BrandedDocumentProps {
  docId?: string;
  /** Optional overrides; otherwise the org's saved invoice/report settings apply. */
  letterheadText?: string;
  footerText?: string;
  showLetterhead?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Renders a document shell (invoice / report / contract / letterhead) that
 * carries the org's branding and prints cleanly on its own page(s). Existing
 * relative logo/favicon URLs are resolved into absolute URLs so image assets
 * render when the page is sent to a print/PDF pipeline.
 */
export function BrandedDocument({
  docId,
  letterheadText,
  footerText,
  showLetterhead,
  className,
  children,
}: BrandedDocumentProps) {
  const { brand } = useBrandingStore();
  const doc = documentBrand(brand);

  return (
    <div
      id={docId}
      className={cn(
        'branded-doc mx-auto w-full max-w-4xl bg-white text-slate-900 print:max-w-none print:shadow-none',
        className,
      )}
      style={{ fontFamily: doc.fontFamily }}
    >
      {doc.letterheadEnabled && showLetterhead !== false && (
        <div className="flex items-start justify-between gap-6 border-b-2 pb-5" style={{ borderColor: doc.primaryColor }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {doc.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.logoUrl}
                  alt={brand.brandName}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-base font-bold text-white"
                  style={{ backgroundColor: doc.primaryColor }}
                >
                  {(brand.brandName.trim().slice(0, 2) || 'BC').toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 style={{ fontFamily: doc.headingFont }} className="text-lg font-bold text-slate-900">
                {brand.brandName}
              </h2>
              {doc.letterheadText ? (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {letterheadText ?? doc.letterheadText}
                </p>
              ) : null}
            </div>
          </div>
          <div className="h-1.5 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${doc.primaryColor}, ${doc.secondaryColor})` }} />
        </div>
      )}

      <div>{children}</div>

      <div className="mt-8 border-t pt-3 text-center text-[10px] text-slate-500">
        {footerText ?? doc.footerText}
      </div>
    </div>
  );
}