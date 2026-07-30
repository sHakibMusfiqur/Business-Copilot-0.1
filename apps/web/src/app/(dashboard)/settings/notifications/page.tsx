'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Shield, Loader2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const NOTIFICATION_OPTIONS = [
  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email', defaultOn: true },
  { key: 'inAppNotifications', label: 'In-App Notifications', desc: 'Show notifications in the app', defaultOn: true },
  { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Receive a weekly summary of activity', defaultOn: true },
  { key: 'loginAlerts', label: 'Login Alerts', desc: 'Get notified of new login attempts', defaultOn: true },
  { key: 'featureAnnouncements', label: 'New Feature Announcements', desc: 'Learn about new features and updates', defaultOn: false },
] as const;

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(NOTIFICATION_OPTIONS.map((opt) => [opt.key, opt.defaultOn]))
  );
  const [securityAlerts] = useState(true);

  const toggle = (key: string) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings/notifications', { ...prefs, securityAlerts });
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'notifications');
      }
      setSaved(true);
      toast({ title: 'Notification settings saved', description: 'Your notification preferences have been updated.', variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save notification settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Notification Channels</h3>
            <p className="text-xs text-muted-foreground mt-1">Select how you want to receive notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          {NOTIFICATION_OPTIONS.map((opt) => (
            <div key={opt.key} className="flex items-center gap-3">
              <Toggle checked={!!prefs[opt.key]} onChange={() => toggle(opt.key)} />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Security Alerts</h3>
            <p className="text-xs text-muted-foreground mt-1">Critical security notifications are always enabled</p>
          </div>
        </div>

        <div className="flex items-center gap-3 opacity-60">
          <Toggle checked={securityAlerts} onChange={() => {}} disabled />
          <div>
            <p className="text-sm font-medium">Security Alerts</p>
            <p className="text-xs text-muted-foreground">Always enabled for your safety</p>
          </div>
        </div>
      </div>
    </SetupPageShell>
  );
}
