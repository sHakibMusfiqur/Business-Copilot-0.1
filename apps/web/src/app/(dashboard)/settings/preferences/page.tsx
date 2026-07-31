'use client';

import { useRouter } from 'next/navigation';
import { Globe, CalendarDays } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { useSettings } from '@/lib/use-settings';

interface PreferencesValues {
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  weekStartsOn: string;
}

const DEFAULTS: PreferencesValues = {
  language: 'English',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  currency: 'USD',
  weekStartsOn: 'Monday',
};

const selectClass =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function PreferencesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { values, loading, loadError, reload, dirty, update, save, saving, saved } =
    useSettings('preferences', { defaults: DEFAULTS });

  const handleSave = async () => {
    try {
      await save();
    } catch (err) {
      toast({
        title: 'Could not save preferences',
        description: err instanceof Error ? err.message : 'Something went wrong while saving.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const session = getOnboardingSession();
      if (session?.id) await markChecklistComplete(session.id, 'preferences');
    } catch {
      // checklist completion is best-effort and must not fail the save
    }
    toast({ title: 'Preferences saved', description: 'Your workspace preferences have been updated.', variant: 'success' });
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
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Localization"
            description="Set your language and regional preferences"
            icon={<Globe className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium">
                  Language *
                </Label>
                <select
                  id="language"
                  value={values.language}
                  onChange={(e) => update({ language: e.target.value })}
                  className={selectClass}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Chinese">Chinese</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-sm font-medium">
                  Timezone *
                </Label>
                <select
                  id="timezone"
                  value={values.timezone}
                  onChange={(e) => update({ timezone: e.target.value })}
                  className={selectClass}
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="US/Eastern">US/Eastern (EST/EDT)</option>
                  <option value="US/Pacific">US/Pacific (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFormat" className="text-sm font-medium">
                  Date Format *
                </Label>
                <select
                  id="dateFormat"
                  value={values.dateFormat}
                  onChange={(e) => update({ dateFormat: e.target.value })}
                  className={selectClass}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm font-medium">
                  Currency *
                </Label>
                <select
                  id="currency"
                  value={values.currency}
                  onChange={(e) => update({ currency: e.target.value })}
                  className={selectClass}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="SAR">SAR - Saudi Riyal</option>
                </select>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Week Settings"
            description="Choose which day your work week starts on"
            icon={<CalendarDays className="h-4 w-4" />}
          >
            <div className="max-w-sm space-y-2">
              <Label htmlFor="weekStartsOn" className="text-sm font-medium">
                Week Starts On *
              </Label>
              <select
                id="weekStartsOn"
                value={values.weekStartsOn}
                onChange={(e) => update({ weekStartsOn: e.target.value })}
                className={selectClass}
              >
                <option value="Monday">Monday</option>
                <option value="Sunday">Sunday</option>
                <option value="Saturday">Saturday</option>
              </select>
            </div>
          </SectionCard>
        </>
      )}
    </SetupPageShell>
  );
}
