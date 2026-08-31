'use client';

import { useRouter } from 'next/navigation';
import { Mail, Send, ShieldCheck } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { usePermissions } from '@/hooks/use-permissions';
import { SETTINGS_MANAGE } from '@/lib/permissions';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { queryClient } from '@/lib/query-client';
import { useSettings } from '@/lib/use-settings';
import { EMAIL_RE } from '@/lib/validation';

interface EmailValues {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  useSSL: boolean;
}

const DEFAULTS: EmailValues = {
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  smtpPassword: '',
  fromEmail: '',
  fromName: '',
  useSSL: false,
};

export default function EmailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission, isLoaded } = usePermissions();

  if (isLoaded && !hasPermission(SETTINGS_MANAGE)) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to manage email settings. Contact your organization owner to request access."
      />
    );
  }

  const { values, loading, loadError, reload, dirty, update, save, saving, saved } =
    useSettings('email', {
      defaults: DEFAULTS,
      normalize: (stored) => ({
        smtpHost: typeof stored.smtpHost === 'string' ? stored.smtpHost : DEFAULTS.smtpHost,
        smtpPort: typeof stored.smtpPort === 'number' ? stored.smtpPort : DEFAULTS.smtpPort,
        smtpUsername: typeof stored.smtpUsername === 'string' ? stored.smtpUsername : DEFAULTS.smtpUsername,
        fromEmail: typeof stored.fromEmail === 'string' ? stored.fromEmail : DEFAULTS.fromEmail,
        fromName: typeof stored.fromName === 'string' ? stored.fromName : DEFAULTS.fromName,
        useSSL: typeof stored.useSSL === 'boolean' ? stored.useSSL : DEFAULTS.useSSL,
        smtpPassword: '',
      }),
    });

  const portInvalid = !Number.isInteger(values.smtpPort) || values.smtpPort < 1 || values.smtpPort > 65535;
  const emailInvalid = !EMAIL_RE.test(values.fromEmail);

  const handleSave = async () => {
    if (values.smtpHost.trim().length === 0) {
      toast({ title: 'Check your settings', description: 'SMTP host is required.', variant: 'destructive' });
      return;
    }
    if (portInvalid) {
      toast({ title: 'Check your settings', description: 'SMTP port must be between 1 and 65535.', variant: 'destructive' });
      return;
    }
    if (values.smtpUsername.trim().length === 0) {
      toast({ title: 'Check your settings', description: 'SMTP username is required.', variant: 'destructive' });
      return;
    }
    if (emailInvalid) {
      toast({ title: 'Check your settings', description: 'Enter a valid from email address.', variant: 'destructive' });
      return;
    }
    if (values.fromName.trim().length === 0) {
      toast({ title: 'Check your settings', description: 'From name is required.', variant: 'destructive' });
      return;
    }

    const { smtpPassword, ...rest } = values;
    const payload = { ...rest } as EmailValues;
    if (smtpPassword.trim().length > 0) payload.smtpPassword = smtpPassword.trim();

    try {
      await save(payload);
    } catch (err) {
      toast({
        title: 'Could not save email settings',
        description: err instanceof Error ? err.message : 'Something went wrong while saving.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'email');
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
      }
    } catch {
      // best-effort
    }
    toast({ title: 'Email settings saved', description: 'Your email configuration has been updated.', variant: 'success' });
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
      dirty={dirty}
    >
      {loadError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <SectionCard
            title="SMTP Server"
            description="Configure your outgoing mail server settings"
            icon={<Send className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtpHost" className="text-sm font-medium">
                  SMTP Host *
                </Label>
                <Input
                  id="smtpHost"
                  value={values.smtpHost}
                  onChange={(e) => update({ smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort" className="text-sm font-medium">
                  SMTP Port *
                </Label>
                <Input
                  id="smtpPort"
                  type="number"
                  min={1}
                  max={65535}
                  value={values.smtpPort}
                  onChange={(e) => update({ smtpPort: e.target.value === '' ? 0 : Number(e.target.value) })}
                  placeholder="587"
                />
                {portInvalid && <p className="text-xs text-destructive">Must be between 1 and 65535</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUsername" className="text-sm font-medium">
                  SMTP Username *
                </Label>
                <Input
                  id="smtpUsername"
                  value={values.smtpUsername}
                  onChange={(e) => update({ smtpUsername: e.target.value })}
                  placeholder="user@gmail.com"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPassword" className="text-sm font-medium">
                  SMTP Password
                </Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  value={values.smtpPassword}
                  onChange={(e) => update({ smtpPassword: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">Leave blank to keep the existing password</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Email Defaults"
            description="Set the default sender information for outgoing emails"
            icon={<Mail className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fromEmail" className="text-sm font-medium">
                  From Email *
                </Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={values.fromEmail}
                  onChange={(e) => update({ fromEmail: e.target.value })}
                  placeholder="noreply@yourcompany.com"
                />
                {emailInvalid && <p className="text-xs text-destructive">Enter a valid email address</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromName" className="text-sm font-medium">
                  From Name *
                </Label>
                <Input
                  id="fromName"
                  value={values.fromName}
                  onChange={(e) => update({ fromName: e.target.value })}
                  placeholder="Your Company Name"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Security"
            description="Configure connection security"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Use SSL/TLS</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Encrypt the connection to your mail server</p>
              </div>
              <Switch
                checked={values.useSSL}
                onCheckedChange={(checked) => update({ useSSL: checked })}
                aria-label="Use SSL/TLS"
              />
            </div>
          </SectionCard>
        </>
      )}
    </SetupPageShell>
  );
}
