'use client';

import { useRouter } from 'next/navigation';
import { CreditCard, MapPin } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { queryClient } from '@/lib/query-client';
import { useSettings } from '@/lib/use-settings';
import { EMAIL_RE } from '@/lib/validation';

interface BillingValues {
  companyName: string;
  taxId: string;
  billingEmail: string;
  address: string;
  city: string;
  country: string;
  currency: string;
}

const DEFAULTS: BillingValues = {
  companyName: '',
  taxId: '',
  billingEmail: '',
  address: '',
  city: '',
  country: '',
  currency: 'USD',
};

const selectClass =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { values, loading, loadError, reload, dirty, update, save, saving, saved } =
    useSettings('billing', { defaults: DEFAULTS });

  const emailInvalid = !EMAIL_RE.test(values.billingEmail);

  const handleSave = async () => {
    if (values.companyName.trim().length < 2) {
      toast({ title: 'Check your settings', description: 'Company name must be at least 2 characters.', variant: 'destructive' });
      return;
    }
    if (emailInvalid) {
      toast({ title: 'Check your settings', description: 'Enter a valid billing email address.', variant: 'destructive' });
      return;
    }
    if (values.address.trim().length < 5) {
      toast({ title: 'Check your settings', description: 'Street address is required.', variant: 'destructive' });
      return;
    }
    if (values.city.trim().length < 2) {
      toast({ title: 'Check your settings', description: 'City is required.', variant: 'destructive' });
      return;
    }
    if (values.country.trim().length === 0) {
      toast({ title: 'Check your settings', description: 'Country is required.', variant: 'destructive' });
      return;
    }
    if (values.currency.trim().length === 0) {
      toast({ title: 'Check your settings', description: 'Currency is required.', variant: 'destructive' });
      return;
    }

    try {
      await save();
    } catch (err) {
      toast({
        title: 'Could not save billing settings',
        description: err instanceof Error ? err.message : 'Something went wrong while saving.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'billing');
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
      }
    } catch {
      // best-effort
    }
    toast({ title: 'Billing settings saved', description: 'Your billing information has been updated.', variant: 'success' });
  };

  return (
    <SetupPageShell
      title="Billing"
      description="Configure your billing information and payment settings"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Billing' },
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
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Billing Information"
            description="Set up your company billing details"
            icon={<CreditCard className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-medium">
                  Company Name *
                </Label>
                <Input
                  id="companyName"
                  value={values.companyName}
                  onChange={(e) => update({ companyName: e.target.value })}
                  placeholder="Acme Corporation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId" className="text-sm font-medium">
                  Tax ID / VAT Number
                </Label>
                <Input
                  id="taxId"
                  value={values.taxId}
                  onChange={(e) => update({ taxId: e.target.value })}
                  placeholder="US123456789"
                />
              </div>
            </div>

            <div className="mt-5 max-w-sm space-y-2">
              <Label htmlFor="billingEmail" className="text-sm font-medium">
                Billing Email *
              </Label>
              <Input
                id="billingEmail"
                type="email"
                value={values.billingEmail}
                onChange={(e) => update({ billingEmail: e.target.value })}
                placeholder="billing@company.com"
              />
              {emailInvalid && <p className="text-xs text-destructive">Enter a valid email address</p>}
            </div>
          </SectionCard>

          <SectionCard
            title="Billing Address"
            description="Enter your billing address"
            icon={<MapPin className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">
                  Street Address *
                </Label>
                <Textarea
                  id="address"
                  value={values.address}
                  onChange={(e) => update({ address: e.target.value })}
                  placeholder="123 Main Street, Suite 100"
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City *
                  </Label>
                  <Input
                    id="city"
                    value={values.city}
                    onChange={(e) => update({ city: e.target.value })}
                    placeholder="San Francisco"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-medium">
                    Country *
                  </Label>
                  <select
                    id="country"
                    value={values.country}
                    onChange={(e) => update({ country: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">Select country</option>
                    <option value="US">United States</option>
                    <option value="AE">United Arab Emirates</option>
                    <option value="SA">Saudi Arabia</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                  </select>
                </div>
              </div>

              <div className="max-w-sm space-y-2">
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
        </>
      )}
    </SetupPageShell>
  );
}
