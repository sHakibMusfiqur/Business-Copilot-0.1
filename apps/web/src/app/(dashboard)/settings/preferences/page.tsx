'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  language: z.string().min(1, 'Language is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  dateFormat: z.string().min(1, 'Date format is required'),
  currency: z.string().min(1, 'Currency is required'),
  weekStartsOn: z.string().min(1, 'Week start is required'),
});

type FormData = z.infer<typeof schema>;

const selectClass = 'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function PreferencesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      language: 'English',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      currency: 'USD',
      weekStartsOn: 'Monday',
    },
  });

  const { register, handleSubmit } = form;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings/preferences', form.getValues());
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'preferences');
      }
      setSaved(true);
      toast({ title: 'Preferences saved', description: 'Your preferences have been updated.', variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save preferences.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupPageShell
      title="Preferences"
      description="Configure your workspace language, timezone, and regional settings"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Preferences' },
      ]}
      onSave={handleSubmit(handleSave)}
      onCancel={() => router.back()}
      saving={saving}
      saved={saved}
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Localization</h3>
          <p className="text-xs text-muted-foreground mt-1">Set your language and regional preferences</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="language">Language *</Label>
            <select id="language" {...register('language')} className={selectClass}>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Arabic">Arabic</option>
              <option value="Chinese">Chinese</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone *</Label>
            <select id="timezone" {...register('timezone')} className={selectClass}>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="US/Eastern">US/Eastern (EST/EDT)</option>
              <option value="US/Pacific">US/Pacific (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dateFormat">Date Format *</Label>
            <select id="dateFormat" {...register('dateFormat')} className={selectClass}>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency *</Label>
            <select id="currency" {...register('currency')} className={selectClass}>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="SAR">SAR - Saudi Riyal</option>
            </select>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Week Settings</h3>
          <p className="text-xs text-muted-foreground mt-1">Choose which day your work week starts on</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="weekStartsOn">Week Starts On *</Label>
          <select id="weekStartsOn" {...register('weekStartsOn')} className={selectClass}>
            <option value="Monday">Monday</option>
            <option value="Sunday">Sunday</option>
            <option value="Saturday">Saturday</option>
          </select>
        </div>
      </div>
    </SetupPageShell>
  );
}
