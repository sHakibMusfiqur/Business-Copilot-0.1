'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.string().min(1, 'SMTP port is required'),
  smtpUsername: z.string().min(1, 'SMTP username is required'),
  smtpPassword: z.string().min(1, 'SMTP password is required'),
  fromEmail: z.string().email('Enter a valid email address'),
  fromName: z.string().min(1, 'From name is required'),
  useSSL: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function EmailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      smtpHost: 'smtp.example.com',
      smtpPort: '587',
      smtpUsername: 'admin@example.com',
      smtpPassword: '',
      fromEmail: 'noreply@example.com',
      fromName: 'Business Copilot',
      useSSL: false,
    },
  });

  const { register, watch, setValue } = form;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings/email', {
        smtpHost: watch('smtpHost'),
        smtpPort: watch('smtpPort'),
        smtpUsername: watch('smtpUsername'),
        smtpPassword: watch('smtpPassword'),
        fromEmail: watch('fromEmail'),
        fromName: watch('fromName'),
        useSSL: watch('useSSL'),
      });
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'email');
      }
      setSaved(true);
      toast({ title: 'Email settings saved', description: 'Your email configuration has been updated.', variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save email settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupPageShell
      title="Email Integration"
      description="Configure your email server to send notifications and invites"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Email Integration' },
      ]}
      onSave={handleSave}
      onCancel={() => router.back()}
      saving={saving}
      saved={saved}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">SMTP Server</h3>
            <p className="text-xs text-muted-foreground mt-1">Configure your outgoing mail server settings</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">SMTP Host *</Label>
            <Input id="smtpHost" {...register('smtpHost')} placeholder="smtp.gmail.com" />
            {form.formState.errors.smtpHost && <p className="text-xs text-destructive">{form.formState.errors.smtpHost.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">SMTP Port *</Label>
            <Input id="smtpPort" {...register('smtpPort')} placeholder="587" />
            {form.formState.errors.smtpPort && <p className="text-xs text-destructive">{form.formState.errors.smtpPort.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtpUsername">SMTP Username *</Label>
            <Input id="smtpUsername" {...register('smtpUsername')} placeholder="user@gmail.com" />
            {form.formState.errors.smtpUsername && <p className="text-xs text-destructive">{form.formState.errors.smtpUsername.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPassword">SMTP Password *</Label>
            <Input id="smtpPassword" type="password" {...register('smtpPassword')} placeholder="••••••••" />
            {form.formState.errors.smtpPassword && <p className="text-xs text-destructive">{form.formState.errors.smtpPassword.message}</p>}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Email Defaults</h3>
          <p className="text-xs text-muted-foreground mt-1">Set the default sender information for outgoing emails</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fromEmail">From Email *</Label>
            <Input id="fromEmail" type="email" {...register('fromEmail')} placeholder="noreply@yourcompany.com" />
            {form.formState.errors.fromEmail && <p className="text-xs text-destructive">{form.formState.errors.fromEmail.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromName">From Name *</Label>
            <Input id="fromName" {...register('fromName')} placeholder="Your Company Name" />
            {form.formState.errors.fromName && <p className="text-xs text-destructive">{form.formState.errors.fromName.message}</p>}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Security</h3>
          <p className="text-xs text-muted-foreground mt-1">Configure connection security</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setValue('useSSL', !watch('useSSL'))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              watch('useSSL') ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              watch('useSSL') ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          <div>
            <p className="text-sm font-medium">Use SSL/TLS</p>
            <p className="text-xs text-muted-foreground">Encrypt the connection to your mail server</p>
          </div>
        </div>
      </div>
    </SetupPageShell>
  );
}
