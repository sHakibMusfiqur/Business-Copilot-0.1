'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreditCard } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  taxId: z.string().optional(),
  billingEmail: z.string().email('Enter a valid email address'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  currency: z.string().min(1, 'Currency is required'),
});

type FormData = z.infer<typeof schema>;

const selectClass = 'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      taxId: '',
      billingEmail: '',
      address: '',
      city: '',
      country: '',
      currency: 'USD',
    },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings/billing', form.getValues());
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'billing');
      }
      setSaved(true);
      toast({ title: 'Billing settings saved', description: 'Your billing information has been updated.', variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save billing settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
      onSave={handleSubmit(handleSave)}
      onCancel={() => router.back()}
      saving={saving}
      saved={saved}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Billing Information</h3>
            <p className="text-xs text-muted-foreground mt-1">Set up your company billing details</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input id="companyName" {...register('companyName')} placeholder="Acme Corporation" />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID / VAT Number</Label>
            <Input id="taxId" {...register('taxId')} placeholder="US123456789" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billingEmail">Billing Email *</Label>
          <Input id="billingEmail" type="email" {...register('billingEmail')} placeholder="billing@company.com" />
          {errors.billingEmail && <p className="text-xs text-destructive">{errors.billingEmail.message}</p>}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Billing Address</h3>
          <p className="text-xs text-muted-foreground mt-1">Enter your billing address</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Street Address *</Label>
          <Textarea id="address" {...register('address')} placeholder="123 Main Street, Suite 100" rows={2} />
          {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input id="city" {...register('city')} placeholder="San Francisco" />
            {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <select id="country" {...register('country')} className={selectClass}>
              <option value="">Select country</option>
              <option value="US">United States</option>
              <option value="AE">United Arab Emirates</option>
              <option value="SA">Saudi Arabia</option>
              <option value="GB">United Kingdom</option>
              <option value="DE">Germany</option>
            </select>
            {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
          </div>
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
          {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
        </div>
      </div>
    </SetupPageShell>
  );
}
