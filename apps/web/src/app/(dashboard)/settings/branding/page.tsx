'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Save, Loader2, Eye, Check, AlertTriangle, Type, Palette, FileText, LogIn, Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { HEX_RE, FONT_RE } from '@/lib/validation';
import { useBrandingStore } from '@/store/branding-store';
import { cn } from '@/lib/utils';

const PRESET_PRIMARY = ['#3B82F6', '#6366F1', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6'];
const PRESET_SECONDARY = ['#8B5CF6', '#6366F1', '#0EA5E9', '#EC4899', '#F97316', '#14B8A6'];
const PRESET_ACCENT = ['#10B981', '#22C55E', '#EAB308', '#F43F5E', '#38BDF8', '#84CC16'];

type FormValues = Omit<
  BrandingTheme,
  'logoUrl' | 'darkLogoUrl' | 'faviconUrl' | 'loginBackgroundUrl' | 'loginIllustrationUrl'
>;

const INITIAL: FormValues = {
  brandName: '',
  tagline: '',
  primaryColor: DEFAULT_BRANDING.primaryColor,
  secondaryColor: DEFAULT_BRANDING.secondaryColor,
  accentColor: DEFAULT_BRANDING.accentColor,
  fontFamily: '',
  headingFont: '',
  dashboardTheme: 'default',
  letterheadEnabled: false,
  letterheadText: '',
  documentFooterText: '',
  invoiceFooterText: '',
  reportFooterText: '',
  emailFooterText: '',
};

type AssetKey = 'logo' | 'favicon' | 'darkLogo' | 'loginBackground' | 'loginIllustration';

const ASSETS: Array<{ key: AssetKey; urlKey: string }> = [
  { key: 'logo', urlKey: 'logoUrl' },
  { key: 'favicon', urlKey: 'faviconUrl' },
  { key: 'darkLogo', urlKey: 'darkLogoUrl' },
  { key: 'loginBackground', urlKey: 'loginBackgroundUrl' },
  { key: 'loginIllustration', urlKey: 'loginIllustrationUrl' },
];

const EMPTY_ASSETS: Record<AssetKey, null> = {
  logo: null,
  favicon: null,
  darkLogo: null,
  loginBackground: null,
  loginIllustration: null,
};

interface PendingFile {
  file: File;
  preview: string | null;
}

const THEME_OPTIONS = [
  { value: 'default', label: 'Default', description: 'Follow the app default' },
  { value: 'light', label: 'Light', description: 'Always light' },
  { value: 'dark', label: 'Dark', description: 'Always dark' },
  { value: 'system', label: 'System', description: 'Follow device setting' },
] as const;

export default function BrandingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [values, setValues] = useState<FormValues>(INITIAL);
  const [pendingFiles, setPendingFiles] = useState<Record<AssetKey, PendingFile | null>>(EMPTY_ASSETS);
  const [savedUrls, setSavedUrls] = useState<Record<AssetKey, string | null>>(EMPTY_ASSETS);
  const [removed, setRemoved] = useState<Record<AssetKey, boolean>>({
    logo: false,
    favicon: false,
    darkLogo: false,
    loginBackground: false,
    loginIllustration: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initialValuesRef = useRef<FormValues | null>(null);
  const savingRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const logoSectionRef = useRef<HTMLDivElement>(null);
  const themeSectionRef = useRef<HTMLDivElement>(null);
  const documentsSectionRef = useRef<HTMLDivElement>(null);
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
    const el =
      tab === 'logo'
        ? logoSectionRef.current
        : tab === 'theme'
          ? themeSectionRef.current
          : tab === 'documents'
            ? documentsSectionRef.current
            : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTabScrolled(true);
    }
  }, [loading, tabScrolled]);

  const loadBranding = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const stored = await getSettings<Partial<BrandingTheme>>('branding');
      if (!mountedRef.current) return;
      const normalized = normalizeBranding(stored);

      const loaded: FormValues = {
        brandName: normalized.brandName,
        tagline: normalized.tagline,
        primaryColor: normalized.primaryColor,
        secondaryColor: normalized.secondaryColor,
        accentColor: normalized.accentColor,
        fontFamily: normalized.fontFamily,
        headingFont: normalized.headingFont,
        dashboardTheme: normalized.dashboardTheme,
        letterheadEnabled: normalized.letterheadEnabled,
        letterheadText: normalized.letterheadText,
        documentFooterText: normalized.documentFooterText,
        invoiceFooterText: normalized.invoiceFooterText,
        reportFooterText: normalized.reportFooterText,
        emailFooterText: normalized.emailFooterText,
      };
      setValues(loaded);
      initialValuesRef.current = loaded;

      const nextSaved = {
        logo: normalized.logoUrl,
        favicon: normalized.faviconUrl,
        darkLogo: normalized.darkLogoUrl,
        loginBackground: normalized.loginBackgroundUrl,
        loginIllustration: normalized.loginIllustrationUrl,
      };
      setSavedUrls(nextSaved);
      setPendingFiles(EMPTY_ASSETS);
      setRemoved({
        logo: false,
        favicon: false,
        darkLogo: false,
        loginBackground: false,
        loginIllustration: false,
      });
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
    const baseUrls = savedUrls;
    const valuesChanged =
      (Object.keys(values) as Array<keyof FormValues>).some(
        (key) => values[key] !== base[key],
      ) || values.brandName !== base.brandName;
    const assetsChanged = ASSETS.some(
      (a) =>
        pendingFiles[a.key] !== null ||
        (removed[a.key] && baseUrls[a.key] !== null),
    );
    return valuesChanged || assetsChanged;
  }, [values, pendingFiles, removed, savedUrls]);

  const brandValues: BrandValues = useMemo(
    () =>
      normalizeBranding({
        ...values,
        logoUrl: removed.logo ? null : (pendingFiles.logo?.preview ?? savedUrls.logo),
        faviconUrl: removed.favicon ? null : (pendingFiles.favicon?.preview ?? savedUrls.favicon),
        darkLogoUrl: removed.darkLogo ? null : (pendingFiles.darkLogo?.preview ?? savedUrls.darkLogo),
        loginBackgroundUrl: removed.loginBackground
          ? null
          : (pendingFiles.loginBackground?.preview ?? savedUrls.loginBackground),
        loginIllustrationUrl: removed.loginIllustration
          ? null
          : (pendingFiles.loginIllustration?.preview ?? savedUrls.loginIllustration),
      }),
    [values, pendingFiles, savedUrls, removed],
  );

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleAssetChange = (key: AssetKey) => (file: File | null, preview: string | null) => {
    setPendingFiles((prev) => ({ ...prev, [key]: file ? { file, preview } : null }));
    setRemoved((prev) => ({ ...prev, [key]: file ? false : true }));
    setSaved(false);
  };

  const validate = (): string | null => {
    if (values.brandName.trim().length < 2) {
      return 'Company name must be at least 2 characters.';
    }
    if (
      !HEX_RE.test(values.primaryColor) ||
      !HEX_RE.test(values.secondaryColor) ||
      !HEX_RE.test(values.accentColor)
    ) {
      return 'All colors must be valid 6-digit hex values.';
    }
    for (const field of ['fontFamily', 'headingFont'] as const) {
      const value = values[field].trim().replace(/["']/g, '');
      if (value && !FONT_RE.test(value)) {
        return `Font names may only contain letters, numbers, spaces, hyphens, underscores, and commas.`;
      }
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
      const urls: Record<AssetKey, string | null> = { ...savedUrls };

      const pending = ASSETS.filter((a) => pendingFiles[a.key]);
      if (pending.length > 0) {
        const uploadPayload: Partial<Record<AssetKey, File>> = {};
        for (const a of pending) {
          const pendingFile = pendingFiles[a.key];
          if (pendingFile) uploadPayload[a.key] = pendingFile.file;
        }
        const uploaded = await uploadSettingsFiles(uploadPayload);
        if (!mountedRef.current) return;
        for (const a of pending) {
          const uploadedUrl = uploaded[a.urlKey as keyof typeof uploaded];
          if (uploadedUrl) urls[a.key] = uploadedUrl;
        }
      }

      for (const a of ASSETS) {
        if (removed[a.key]) urls[a.key] = null;
      }

      const payload: Partial<BrandingTheme> = {
        brandName: values.brandName.trim(),
        tagline: values.tagline.trim(),
        primaryColor: values.primaryColor,
        secondaryColor: values.secondaryColor,
        accentColor: values.accentColor,
        fontFamily: values.fontFamily.trim().replace(/["']/g, ''),
        headingFont: values.headingFont.trim().replace(/["']/g, ''),
        dashboardTheme: values.dashboardTheme,
        letterheadEnabled: values.letterheadEnabled,
        letterheadText: values.letterheadText.trim(),
        documentFooterText: values.documentFooterText.trim(),
        invoiceFooterText: values.invoiceFooterText.trim(),
        reportFooterText: values.reportFooterText.trim(),
        emailFooterText: values.emailFooterText.trim(),
      };
      payload.logoUrl = urls.logo;
      payload.faviconUrl = urls.favicon;
      payload.darkLogoUrl = urls.darkLogo;
      payload.loginBackgroundUrl = urls.loginBackground;
      payload.loginIllustrationUrl = urls.loginIllustration;

      await updateSettings('branding', payload);
      if (!mountedRef.current) return;

      useBrandingStore.getState().setBrand(normalizeBranding(payload));

      const session = getOnboardingSession();
      if (session?.id) {
        const completions: Promise<unknown>[] = [markChecklistComplete(session.id, 'branding')];
        if (urls.logo) completions.push(markChecklistComplete(session.id, 'logo'));
        const results = await Promise.allSettled(completions);
        for (const result of results) {
          if (result.status === 'rejected') {
            console.error('Checklist completion failed after branding save', result.reason);
          }
        }
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
      }

      initialValuesRef.current = { ...values };
      setSaved(true);
      setPendingFiles(EMPTY_ASSETS);
      setSavedUrls(urls);
      setRemoved({
        logo: false,
        favicon: false,
        darkLogo: false,
        loginBackground: false,
        loginIllustration: false,
      });
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

  const renderField = (label: string, id: string) => ({ field, placeholder, hint }: {
    field: keyof FormValues;
    placeholder?: string;
    hint?: string;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <Input
        id={id}
        value={values[field] as string}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

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
                description="Primary and dark-mode logos shown across your workspace, emails, and login page."
                icon={<Eye className="h-4 w-4" />}
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Light logo</p>
                    <FileUpload
                      variant="logo"
                      preview={removed.logo ? null : (pendingFiles.logo?.preview ?? savedUrls.logo)}
                      onChange={handleAssetChange('logo')}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Dark logo</p>
                    <FileUpload
                      variant="darkLogo"
                      preview={removed.darkLogo ? null : (pendingFiles.darkLogo?.preview ?? savedUrls.darkLogo)}
                      onChange={handleAssetChange('darkLogo')}
                      disabled={saving}
                    />
                  </div>
                </div>
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
                    preview={removed.favicon ? null : (pendingFiles.favicon?.preview ?? savedUrls.favicon)}
                    onChange={handleAssetChange('favicon')}
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

            <SectionCard
              title="Login Appearance"
              description="Background image and illustration shown on your branded login and invitation pages."
              icon={<LogIn className="h-4 w-4" />}
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Background image</p>
                  <FileUpload
                    variant="loginBackground"
                    preview={removed.loginBackground ? null : (pendingFiles.loginBackground?.preview ?? savedUrls.loginBackground)}
                    onChange={handleAssetChange('loginBackground')}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Illustration</p>
                  <FileUpload
                    variant="loginIllustration"
                    preview={removed.loginIllustration ? null : (pendingFiles.loginIllustration?.preview ?? savedUrls.loginIllustration)}
                    onChange={handleAssetChange('loginIllustration')}
                    disabled={saving}
                  />
                </div>
              </div>
            </SectionCard>

            <div ref={themeSectionRef} className="scroll-mt-28">
              <SectionCard
                title="Brand Identity"
                description="Define your brand name, color palette, and typography used throughout the product."
                icon={<Palette className="h-4 w-4" />}
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

                <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-muted/20 p-3">
                  <Type className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="w-full space-y-4">
                    {renderField('Body Font', 'fontFamily')({
                      field: 'fontFamily',
                      placeholder: 'Inter, Roboto, etc.',
                      hint: 'Google Fonts family name, e.g. "Inter" or "Source Sans 3". Applies to all text.',
                    })}
                    {renderField('Heading Font', 'headingFont')({
                      field: 'headingFont',
                      placeholder: 'Same as body by default',
                      hint: 'Optional. Applies to titles, headings, and document letterheads.',
                    })}
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Dashboard Theme"
              description="Default appearance of your team's dashboards. Team members can still override it themselves."
              icon={<Layers className="h-4 w-4" />}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField('dashboardTheme', opt.value)}
                    disabled={saving}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all',
                      values.dashboardTheme === opt.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-background hover:border-primary/40',
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">{opt.description}</span>
                  </button>
                ))}
              </div>
            </SectionCard>

            <div ref={documentsSectionRef} className="scroll-mt-28">
              <SectionCard
                title="Documents & Emails"
                description="Letterhead and footer text applied to invoices, reports, documents, and outgoing emails."
                icon={<FileText className="h-4 w-4" />}
              >
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Letterhead</p>
                    <p className="text-xs text-muted-foreground">Show company letterhead on printed documents.</p>
                  </div>
                  <Switch
                    checked={values.letterheadEnabled}
                    onCheckedChange={(checked) => setField('letterheadEnabled', checked)}
                    disabled={saving}
                  />
                </div>

                <AnimatePresence>
                  {values.letterheadEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4">
                        <Label htmlFor="letterheadText" className="text-sm font-medium">Letterhead Text</Label>
                        <Textarea
                          id="letterheadText"
                          value={values.letterheadText}
                          onChange={(e) => setField('letterheadText', e.target.value)}
                          placeholder="123 Enterprise Ave, Suite 400, San Francisco, CA 94107 · hello@acme.com"
                          className="mt-2 min-h-20"
                          maxLength={500}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Max 500 characters.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {renderField('Document Footer', 'documentFooterText')({
                    field: 'documentFooterText',
                    placeholder: 'Terms · Confidential',
                    hint: 'Appears on reports, contracts, and general documents.',
                  })}
                  {renderField('Invoice Footer', 'invoiceFooterText')({
                    field: 'invoiceFooterText',
                    placeholder: 'Payment due within 30 days',
                  })}
                  {renderField('Report Footer', 'reportFooterText')({
                    field: 'reportFooterText',
                    placeholder: 'Generated by Acme Business Copilot',
                  })}
                  {renderField('Email Footer', 'emailFooterText')({
                    field: 'emailFooterText',
                    placeholder: 'You are receiving this because...',
                    hint: 'Appears on all branded emails.',
                  })}
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
