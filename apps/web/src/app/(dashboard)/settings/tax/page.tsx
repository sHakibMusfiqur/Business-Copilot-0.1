'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileBarChart } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  defaultTaxRate: z.string().refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, 'Must be between 0 and 100'),
  calculationMethod: z.string().min(1, 'Method is required'),
  taxLabel: z.string().min(1, 'Tax label is required'),
  enableShippingTax: z.boolean(),
  countryRates: z.boolean(),
  taxProducts: z.boolean(),
  taxServices: z.boolean(),
  taxShipping: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const selectClass = 'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

export default function TaxPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultTaxRate: '0',
      calculationMethod: 'Exclusive',
      taxLabel: 'VAT',
      enableShippingTax: false,
      countryRates: false,
      taxProducts: true,
      taxServices: true,
      taxShipping: false,
    },
  });

  const { register, handleSubmit, watch, setValue } = form;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings/tax', form.getValues());
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'tax');
      }
      setSaved(true);
      toast({ title: 'Tax settings saved', description: 'Your tax configuration has been updated.', variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save tax settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
      onSave={handleSubmit(handleSave)}
      onCancel={() => router.back()}
      saving={saving}
      saved={saved}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileBarChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Tax Settings</h3>
            <p className="text-xs text-muted-foreground mt-1">Configure default tax rates and calculation methods</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="defaultTaxRate">Default Tax Rate (%) *</Label>
            <Input id="defaultTaxRate" {...register('defaultTaxRate')} type="number" min={0} max={100} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calculationMethod">Calculation Method *</Label>
            <select id="calculationMethod" {...register('calculationMethod')} className={selectClass}>
              <option value="Exclusive">Exclusive (tax added to price)</option>
              <option value="Inclusive">Inclusive (tax included in price)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxLabel">Tax Label *</Label>
          <Input id="taxLabel" {...register('taxLabel')} placeholder="VAT, GST, Sales Tax..." />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Shipping Tax</h3>
          <p className="text-xs text-muted-foreground mt-1">Configure tax on shipping charges</p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={watch('enableShippingTax')} onChange={() => setValue('enableShippingTax', !watch('enableShippingTax'))} />
          <div>
            <p className="text-sm font-medium">Enable Tax on Shipping</p>
            <p className="text-xs text-muted-foreground">Apply default tax rate to shipping costs</p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Country-Specific Rates</h3>
          <p className="text-xs text-muted-foreground mt-1">Enable different tax rates based on country</p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={watch('countryRates')} onChange={() => setValue('countryRates', !watch('countryRates'))} />
          <div>
            <p className="text-sm font-medium">Enable Country-Specific Rates</p>
            <p className="text-xs text-muted-foreground">Set different tax rates for different countries</p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Apply Tax To</h3>
          <p className="text-xs text-muted-foreground mt-1">Select which product categories are taxable</p>
        </div>
        <div className="space-y-3">
          {[
            { key: 'taxProducts', label: 'Products', desc: 'Apply tax to physical and digital products' },
            { key: 'taxServices', label: 'Services', desc: 'Apply tax to service offerings' },
            { key: 'taxShipping', label: 'Shipping', desc: 'Apply tax to shipping fees' },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <Toggle
                checked={watch(item.key as 'taxProducts' | 'taxServices' | 'taxShipping')}
                onChange={() => {
                  const k = item.key as 'taxProducts' | 'taxServices' | 'taxShipping';
                  setValue(k, !watch(k));
                }}
              />
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SetupPageShell>
  );
}
