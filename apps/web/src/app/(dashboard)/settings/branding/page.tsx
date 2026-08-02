'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Save, Loader2, Eye, Check, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { FileUpload } from '@/components/settings/branding/file-upload';
import { ColorField } from '@/components/settings/branding/color-field';
import { SectionCard } from '@/components/setup/section-card';
import { BrandPreview, type BrandValues } from '@/components/settings/branding/brand-preview';
import { getSettings, updateSettings, uploadSettingsFiles } from '@/lib/api';
import { DEFAULT_BRANDING, normalizeBranding, type BrandingTheme } from '@/lib/branding';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { queryClient } from '@/lib/query-client';
import { HEX_RE } from '@/lib/validation';
import { useBrandingStore } from '@/store/branding-store';

const PRESET_PRIMARY = ['#3B82F6', '#6366F1', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6'];
const PRESET_SECONDARY = ['#8B5CF6', '#6366F1', '#0EA5E9', '#EC4899', '#F97316', '#14B8A6'];
const PRESET_ACCENT = ['#10B981', '#22C55E', '#EAB308', '#F43F5E', '#38BDF8', '#84CC16'];

type BrandSettings = Pick<BrandingTheme, 'brandName' | 'tagline' | 'primaryColor' | 'secondaryColor' | 'accentColor'>;

const INITIAL: BrandSettings = {
  brandName: '',
  tagline: '',
  primaryColor: DEFAULT_BRANDING.primaryColor,
  secondaryColor: DEFAULT_BRANDING.secondaryColor,
  accentColor: DEFAULT_BRANDING.accentColor,
};

interface PendingFile {
  file: File;
  preview: string | null;
}

export default function BrandingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [values, setValues] = useState<BrandSettings>(INITIAL);
  const [logoFile, setLogoFile] = useState<PendingFile | null>(null);
  const [faviconFile, setFaviconFile] = useState<PendingFile | null>(null);
  const [savedLogoUrl, setSavedLogoUrl] = useState<string | null>(null);
  const [savedFaviconUrl, setSavedFaviconUrl] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [faviconRemoved, setFaviconRemoved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initialValuesRef = useRef<BrandSettings | null>(null);
  const savingRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const logoSectionRef = useRef<HTMLDivElement>(null);
  const themeSectionRef = useRef<HTMLDivElement>(null);
  const [tabScrolled, setTabScrolled] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (loading || tabScrolled) return;
    const tab = new URLSearchParams(window.location.search).get('tab');
    const el = tab === 'logo' ? logoSectionRef.current : tab === 'theme' ? themeSectionRef.current : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTabScrolled(true);
    }
  }, [loading, tabScrolled]);

  const loadBranding = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const stored = await getSettings<Partial<BrandSettings> & { logoUrl?: string; faviconUrl?: string }>('branding');
      if (!mountedRef.current) return;
      const loaded: BrandSettings = {
        brandName: typeof stored?.brandName === 'string' ? stored.brandName : INITIAL.brandName,
        tagline: typeof stored?.tagline === 'string' ? stored.tagline : INITIAL.tagline,
        primaryColor: typeof stored?.primaryColor === 'string' ? stored.primaryColor : INITIAL.primaryColor,
        secondaryColor: typeof stored?.secondaryColor === 'string' ? stored.secondaryColor : INITIAL.secondaryColor,
        accentColor: typeof stored?.accentColor === 'string' ? stored.accentColor : INITIAL.accentColor,
      };
      setValues(loaded);
      initialValuesRef.current = loaded;
      setSavedLogoUrl(typeof stored?.logoUrl === 'string' ? stored.logoUrl : null);
      setSavedFaviconUrl(typeof stored?.faviconUrl === 'string' ? stored.faviconUrl : null);
      setLogoRemoved(false);
      setFaviconRemoved(false);
      setSaved(false);
    } catch {
      if (mountedRef.current) setLoadError('Could not load your brand settings. Please try again.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const dirty = useMemo(() => {
    const base = initialValuesRef.current ?? INITIAL;
    return (
      values.brandName !== base.brandName ||
      values.tagline !== base.tagline ||
      values.primaryColor !== base.primaryColor ||
      values.secondaryColor !== base.secondaryColor ||
      values.accentColor !== base.accentColor ||
      logoFile !== null ||
      faviconFile !== null ||
      (logoRemoved && savedLogoUrl !== null) ||
      (faviconRemoved && savedFaviconUrl !== null)
    );
  }, [values, logoFile, faviconFile, logoRemoved, faviconRemoved, savedLogoUrl, savedFaviconUrl]);

  const brandValues: BrandValues = {
    brandName: values.brandName,
    tagline: values.tagline,
    primaryColor: values.primaryColor,
    secondaryColor: values.secondaryColor,
    accentColor: values.accentColor,
    logoUrl: logoRemoved ? null : (logoFile?.preview ?? savedLogoUrl),
    faviconUrl: faviconRemoved ? null : (faviconFile?.preview ?? savedFaviconUrl),
  };

  const setField = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const validate = (): string | null => {
    if (values.brandName.trim().length < 2) {
      return 'Company name must be at least 2 characters.';
    }
    if (!HEX_RE.test(values.primaryColor) || !HEX_RE.test(values.secondaryColor) || !HEX_RE.test(values.accentColor)) {
      return 'All colors must be valid 6-digit hex values.';
    }
    return null;
  };

  const handleSave = async () => {
    if (savingRef.current) return;

    const err = validate();
    if (err) {
      toast({ title: 'Check your settings', description: err, variant: 'destructive' });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaved(false);
    try {
      let logoUrl = logoRemoved ? '' : savedLogoUrl;
      let faviconUrl = faviconRemoved ? '' : savedFaviconUrl;

      if (logoFile || faviconFile) {
        const uploaded = await uploadSettingsFiles({
          logo: logoFile?.file,
          favicon: faviconFile?.file,
        });
        if (!mountedRef.current) return;
        if (uploaded.logoUrl) logoUrl = uploaded.logoUrl;
        if (uploaded.faviconUrl) faviconUrl = uploaded.faviconUrl;
      }

      await updateSettings('branding', {
        brandName: values.brandName.trim(),
        tagline: values.tagline.trim(),
        primaryColor: values.primaryColor,
        secondaryColor: values.secondaryColor,
        accentColor: values.accentColor,
        ...(logoUrl ? { logoUrl } : logoRemoved ? { logoUrl } : {}),
        ...(faviconUrl ? { faviconUrl } : faviconRemoved ? { faviconUrl } : {}),
      });
      if (!mountedRef.current) return;

      useBrandingStore.getState().setBrand(
        normalizeBranding({
          brandName: values.brandName.trim(),
          tagline: values.tagline.trim(),
          primaryColor: values.primaryColor,
          secondaryColor: values.secondaryColor,
          accentColor: values.accentColor,
          logoUrl: logoUrl || null,
          faviconUrl: faviconUrl || null,
        }),
      );

      const session = getOnboardingSession();
      if (session?.id) {
        const completions: Promise<unknown>[] = [markChecklistComplete(session.id, 'branding')];
        if (logoUrl) completions.push(markChecklistComplete(session.id, 'logo'));
        const results = await Promise.allSettled(completions);
        // Branding save must succeed regardless of checklist completion; the
        // latter is best-effort, so failures are surfaced only for ops.
        for (const result of results) {
          if (result.status === 'rejected') {
            console.error('Checklist completion failed after branding save', result.reason);
          }
        }
        // Keep the dashboard checklist widget fresh without touching the
        // onboarding session query.
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
      }

      initialValuesRef.current = { ...values };
      setSaved(true);
      setLogoFile(null);
      setFaviconFile(null);
      setSavedLogoUrl(logoRemoved ? null : logoUrl);
      setSavedFaviconUrl(faviconRemoved ? null : faviconUrl);
      setLogoRemoved(false);
      setFaviconRemoved(false);
      toast({ title: 'Branding saved', description: 'Your brand settings have been updated successfully.', variant: 'success' });

      if (session?.id) {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = setTimeout(() => router.push(`/onboarding/success?session=${session.id}`), 900);
      }
    } catch (saveErr) {
      toast({
        title: 'Could not save branding',
        description: saveErr instanceof Error ? saveErr.message : 'Something went wrong while saving.',
        variant: 'destructive',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/settings" className="transition-colors hover:text-foreground">Settings</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Branding</span>
        </nav>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Branding</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Customize your company identity — everything updates live as you edit.
            </p>
          </div>
          <AnimatePresence>
            {dirty && !saving && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Unsaved changes
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {loadError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadBranding()}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px]">
          {/* Left: form */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="min-w-0 space-y-6"
          >
            <div ref={logoSectionRef} className="scroll-mt-28">
              <SectionCard
                title="Company Logo"
                description="Upload the logo shown across your workspace, emails, and login page."
                icon={<Eye className="h-4 w-4" />}
              >
                <FileUpload
                  variant="logo"
                  preview={logoRemoved ? null : (logoFile?.preview ?? savedLogoUrl)}
                  onChange={(file, preview) => {
                    setLogoFile(file ? { file, preview } : null);
                    if (file) setLogoRemoved(false);
                    else setLogoRemoved(true);
                    setSaved(false);
                  }}
                  disabled={saving}
                />
              </SectionCard>
            </div>

            <SectionCard
              title="Favicon"
              description="The small icon displayed in the browser tab next to your page title."
              icon={<Eye className="h-4 w-4" />}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <FileUpload
                    variant="favicon"
                    preview={faviconRemoved ? null : (faviconFile?.preview ?? savedFaviconUrl)}
                    onChange={(file, preview) => {
                      setFaviconFile(file ? { file, preview } : null);
                      if (file) setFaviconRemoved(false);
                      else setFaviconRemoved(true);
                      setSaved(false);
                    }}
                    disabled={saving}
                  />
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-slate-200/60 bg-muted/20 px-4 py-3 dark:border-white/10">
                  <p className="text-[11px] font-medium text-muted-foreground">Browser tab preview</p>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
                    {brandValues.faviconUrl ? (
                      <div
                        className="h-4 w-4 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${brandValues.faviconUrl})` }}
                      />
                    ) : (
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: values.primaryColor }} />
                    )}
                    <span className="text-xs text-foreground">{values.brandName || 'Company'}</span>
                  </div>
                </div>
              </div>
            </SectionCard>

            <div ref={themeSectionRef} className="scroll-mt-28">
              <SectionCard
                title="Brand Identity"
                description="Define your brand name and color palette used throughout the product."
                icon={<Eye className="h-4 w-4" />}
              >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brandName" className="text-sm font-medium">Company Name *</Label>
                  <Input
                    id="brandName"
                    value={values.brandName}
                    onChange={(e) => setField('brandName', e.target.value)}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline" className="text-sm font-medium">Tagline</Label>
                  <Input
                    id="tagline"
                    value={values.tagline}
                    onChange={(e) => setField('tagline', e.target.value)}
                    placeholder="Enterprise Business Copilot"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-1">
                <div className="grid gap-6 md:grid-cols-3">
                  <ColorField
                    label="Primary Color"
                    description="Main brand color"
                    value={values.primaryColor}
                    onChange={(hex) => setField('primaryColor', hex)}
                    presets={PRESET_PRIMARY}
                  />
                  <ColorField
                    label="Secondary Color"
                    description="Gradients & accents"
                    value={values.secondaryColor}
                    onChange={(hex) => setField('secondaryColor', hex)}
                    presets={PRESET_SECONDARY}
                  />
                  <ColorField
                    label="Accent Color"
                    description="Call-to-actions"
                    value={values.accentColor}
                    onChange={(hex) => setField('accentColor', hex)}
                    presets={PRESET_ACCENT}
                  />
                </div>
              </div>
            </SectionCard>
            </div>

            {/* Save bar */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="sticky bottom-4 z-10"
            >
              <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200/60 bg-white/80 px-5 py-3.5 shadow-xl shadow-slate-300/30 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:shadow-black/40">
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || saved || !dirty}
                  className="min-w-[150px] gap-2"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : saved ? (
                    <><Check className="h-4 w-4" /> Saved</>
                  ) : (
                    <><Save className="h-4 w-4" /> Save Changes</>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: sticky live preview */}
          <motion.aside
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="min-w-0"
          >
            <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-lg shadow-slate-200/40 backdrop-blur-xl lg:sticky lg:top-24 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Live Preview</h2>
                  <p className="text-[11px] text-muted-foreground">Updates instantly while you edit</p>
                </div>
              </div>
              <BrandPreview brand={brandValues} />
            </div>
          </motion.aside>
        </div>
      )}
    </div>
  );
}
