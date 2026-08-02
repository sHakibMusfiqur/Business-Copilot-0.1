'use client';

import { useRouter } from 'next/navigation';
import { Globe2, Percent, Ship, ShoppingCart } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { queryClient } from '@/lib/query-client';
import { useSettings } from '@/lib/use-settings';

interface TaxValues {
  defaultTaxRate: number;
  calculationMethod: string;
  taxLabel: string;
  enableShippingTax: boolean;
  countryRates: boolean;
  taxProducts: boolean;
  taxServices: boolean;
  taxShipping: boolean;
}

const DEFAULTS: TaxValues = {
  defaultTaxRate: 0,
  calculationMethod: 'Exclusive',
  taxLabel: 'VAT',
  enableShippingTax: false,
  countryRates: false,
  taxProducts: true,
  taxServices: true,
  taxShipping: false,
};

const selectClass =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const APPLY_TO_OPTIONS = [
  { key: 'taxProducts', label: 'Products', desc: 'Apply tax to physical and digital products' },
  { key: 'taxServices', label: 'Services', desc: 'Apply tax to service offerings' },
  { key: 'taxShipping', label: 'Shipping', desc: 'Apply tax to shipping fees' },
] as const;

export default function TaxPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { values, loading, loadError, reload, dirty, update, save, saving, saved } =
    useSettings('tax', {
      defaults: DEFAULTS,
      normalize: (stored) => ({
        defaultTaxRate: typeof stored.defaultTaxRate === 'number' ? stored.defaultTaxRate : DEFAULTS.defaultTaxRate,
      }),
    });

  const rateInvalid = !Number.isFinite(values.defaultTaxRate) || values.defaultTaxRate < 0 || values.defaultTaxRate > 100;

  const handleSave = async () => {
    if (rateInvalid) {
      toast({ title: 'Check your settings', description: 'Default tax rate must be between 0 and 100.', variant: 'destructive' });
      return;
    }
    try {
      await save();
    } catch (err) {
      toast({
        title: 'Could not save tax settings',
        description: err instanceof Error ? err.message : 'Something went wrong while saving.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'tax');
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
      }
    } catch {
      // best-effort
    }
    toast({ title: 'Tax settings saved', description: 'Your tax configuration has been updated.', variant: 'success' });
  };

  return (
    <SetupPageShell
      title="Tax & Compliance"
      description="Configure tax rates and compliance settings for your organization"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Tax & Compliance' },
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
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Tax Settings"
            description="Configure default tax rates and calculation methods"
            icon={<Percent className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultTaxRate" className="text-sm font-medium">
                  Default Tax Rate (%) *
                </Label>
                <Input
                  id="defaultTaxRate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={values.defaultTaxRate}
                  onChange={(e) => {
                    const parsed = e.target.value === '' ? 0 : Number(e.target.value);
                    update({ defaultTaxRate: parsed });
                  }}
                  placeholder="0"
                />
                {rateInvalid && (
                  <p className="text-xs text-destructive">Must be a number between 0 and 100</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="calculationMethod" className="text-sm font-medium">
                  Calculation Method *
                </Label>
                <select
                  id="calculationMethod"
                  value={values.calculationMethod}
                  onChange={(e) => update({ calculationMethod: e.target.value })}
                  className={selectClass}
                >
                  <option value="Exclusive">Exclusive (tax added to price)</option>
                  <option value="Inclusive">Inclusive (tax included in price)</option>
                </select>
              </div>
            </div>

            <div className="mt-5 max-w-sm space-y-2">
              <Label htmlFor="taxLabel" className="text-sm font-medium">
                Tax Label *
              </Label>
              <Input
                id="taxLabel"
                value={values.taxLabel}
                onChange={(e) => update({ taxLabel: e.target.value })}
                placeholder="VAT, GST, Sales Tax..."
                maxLength={50}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Shipping Tax"
            description="Configure tax on shipping charges"
            icon={<Ship className="h-4 w-4" />}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Tax on Shipping</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Apply default tax rate to shipping costs</p>
              </div>
              <Switch
                checked={values.enableShippingTax}
                onCheckedChange={(checked) => update({ enableShippingTax: checked })}
                aria-label="Enable Tax on Shipping"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Country-Specific Rates"
            description="Enable different tax rates based on country"
            icon={<Globe2 className="h-4 w-4" />}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Country-Specific Rates</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Set different tax rates for different countries</p>
              </div>
              <Switch
                checked={values.countryRates}
                onCheckedChange={(checked) => update({ countryRates: checked })}
                aria-label="Enable Country-Specific Rates"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Apply Tax To"
            description="Select which product categories are taxable"
            icon={<ShoppingCart className="h-4 w-4" />}
          >
            <div className="divide-y divide-slate-200/60 dark:divide-white/10">
              {APPLY_TO_OPTIONS.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={!!values[item.key]}
                    onCheckedChange={(checked) => update({ [item.key]: checked })}
                    aria-label={item.label}
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </SetupPageShell>
  );
}
