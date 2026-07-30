'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  brandName: z.string().min(2, 'Brand name must be at least 2 characters'),
  logoUrl: z.string().url().or(z.literal('')),
  tagline: z.string().optional(),
  primaryColor: z.string(),
  faviconUrl: z.string().url().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function BrandingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      brandName: '',
      logoUrl: '',
      tagline: '',
      primaryColor: '#3B82F6',
      faviconUrl: '',
    },
  });

  const { register, handleSubmit, watch, setValue } = form;
  const primaryColor = watch('primaryColor');

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        brandName: form.getValues('brandName'),
        logoUrl: form.getValues('logoUrl'),
        tagline: form.getValues('tagline'),
        primaryColor: form.getValues('primaryColor'),
        faviconUrl: form.getValues('faviconUrl'),
      };
      await api.post('/settings/branding', data);
      const session = getOnboardingSession();
      if (session?.id) {
        await Promise.all([
          markChecklistComplete(session.id, 'logo'),
          markChecklistComplete(session.id, 'branding'),
        ]);
      }
      setSaved(true);
      toast({ title: 'Branding updated', description: 'Your brand settings have been saved.', variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save branding settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupPageShell
      title="Branding"
      description="Upload your company logo and customize your brand identity"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Branding' },
      ]}
      onSave={handleSave}
      onCancel={() => router.back()}
      saving={saving}
      saved={saved}
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Company Logo</h3>
          <p className="text-xs text-muted-foreground mt-1">Upload your company logo for use across the platform</p>
        </div>
        <div className="flex items-center gap-6">
          <div className={cn(
            "flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed bg-muted/50 transition-colors",
            logoPreview ? "border-primary/30" : "border-muted-foreground/25"
          )}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded-lg object-contain" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              placeholder="https://example.com/logo.png"
              value={form.watch('logoUrl')}
              onChange={(e) => {
                form.setValue('logoUrl', e.target.value);
                setLogoPreview(e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Brand Identity</h3>
          <p className="text-xs text-muted-foreground mt-1">Define your brand appearance and messaging</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand Name *</Label>
            <Input id="brandName" {...register('brandName')} placeholder="Acme Corporation" />
            {form.formState.errors.brandName && (
              <p className="text-xs text-destructive">{form.formState.errors.brandName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Primary Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setValue('primaryColor', e.target.value)}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-border"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setValue('primaryColor', e.target.value)}
                placeholder="#3B82F6"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" {...register('tagline')} placeholder="Enterprise Business Copilot" />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Favicon</h3>
          <p className="text-xs text-muted-foreground mt-1">Set a custom favicon for your browser tab</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="faviconUrl">Favicon URL</Label>
          <Input id="faviconUrl" {...register('faviconUrl')} placeholder="https://example.com/favicon.ico" />
        </div>
      </div>
    </SetupPageShell>
  );
}
