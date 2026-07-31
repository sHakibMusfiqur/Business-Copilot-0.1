'use client';

import { useRouter } from 'next/navigation';
import { Bell, ShieldCheck } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { useSettings } from '@/lib/use-settings';

const NOTIFICATION_OPTIONS = [
  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
  { key: 'inAppNotifications', label: 'In-App Notifications', desc: 'Show notifications in the app' },
  { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Receive a weekly summary of activity' },
  { key: 'loginAlerts', label: 'Login Alerts', desc: 'Get notified of new login attempts' },
  { key: 'featureAnnouncements', label: 'New Feature Announcements', desc: 'Learn about new features and updates' },
] as const;

type NotificationKeys =
  | 'emailNotifications'
  | 'inAppNotifications'
  | 'weeklyDigest'
  | 'loginAlerts'
  | 'featureAnnouncements'
  | 'securityAlerts';

type NotificationsValues = Record<NotificationKeys, boolean>;

const DEFAULTS: NotificationsValues = {
  emailNotifications: true,
  inAppNotifications: true,
  weeklyDigest: true,
  loginAlerts: true,
  featureAnnouncements: false,
  securityAlerts: true,
};

export default function NotificationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { values, loading, loadError, reload, dirty, update, save, saving, saved } =
    useSettings('notifications', {
      defaults: DEFAULTS,
      normalize: (stored) => {
        const next: Partial<NotificationsValues> = {};
        for (const key of Object.keys(DEFAULTS) as NotificationKeys[]) {
          if (typeof stored[key] === 'boolean') next[key] = stored[key];
        }
        return next;
      },
    });

  const toggle = (key: NotificationKeys) => update({ [key]: !values[key] });

  const handleSave = async () => {
    try {
      await save();
    } catch (err) {
      toast({
        title: 'Could not save notification settings',
        description: err instanceof Error ? err.message : 'Something went wrong while saving.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const session = getOnboardingSession();
      if (session?.id) await markChecklistComplete(session.id, 'notifications');
    } catch {
      // best-effort
    }
    toast({ title: 'Notification settings saved', description: 'Your notification preferences have been updated.', variant: 'success' });
  };

  return (
    <SetupPageShell
      title="Notifications"
      description="Choose how and when you want to be notified"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Notifications' },
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
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Notification Channels"
            description="Select how you want to receive notifications"
            icon={<Bell className="h-4 w-4" />}
          >
            <div className="divide-y divide-slate-200/60 dark:divide-white/10">
              {NOTIFICATION_OPTIONS.map((opt) => (
                <div key={opt.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                  <Switch
                    checked={!!values[opt.key]}
                    onCheckedChange={() => toggle(opt.key)}
                    aria-label={opt.label}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Security Alerts"
            description="Critical security notifications are always enabled"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Security Alerts</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Always enabled for your safety</p>
              </div>
              <Switch checked={true} onCheckedChange={() => undefined} disabled aria-label="Security Alerts" />
            </div>
          </SectionCard>
        </>
      )}
    </SetupPageShell>
  );
}
