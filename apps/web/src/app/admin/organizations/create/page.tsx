'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createAdminOrganization, getAdminPlans } from '@/lib/api';
import type { SubscriptionPlanResponse } from '@/lib/api';

const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name is required'),
  ownerEmail: z.string().email('Valid email is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  ownerPassword: z.string().min(6, 'Password must be at least 6 characters'),
  planSlug: z.string().optional(),
});

type CreateOrgForm = z.infer<typeof createOrgSchema>;

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => getAdminPlans(),
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgForm>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { planSlug: '' },
  });

  async function onSubmit(data: CreateOrgForm) {
    setError(null);
    try {
      await createAdminOrganization(data);
      router.replace('/admin/organizations');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setError(message);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/organizations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold">Create Organization</h1>
        <p className="text-muted-foreground">Provision a new organization with an owner</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border bg-card p-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Organization Name</label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                {...register('name')}
                className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Acme Corp"
              />
            </div>
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Organization Owner</h3>

          <div>
            <label className="text-sm font-medium">Owner Name</label>
            <input
              {...register('ownerName')}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="John Doe"
            />
            {errors.ownerName && <p className="mt-1 text-xs text-destructive">{errors.ownerName.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Owner Email</label>
            <input
              {...register('ownerEmail')}
              type="email"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="john@acme.com"
            />
            {errors.ownerEmail && <p className="mt-1 text-xs text-destructive">{errors.ownerEmail.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Owner Password</label>
            <input
              {...register('ownerPassword')}
              type="password"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Minimum 6 characters"
            />
            {errors.ownerPassword && <p className="mt-1 text-xs text-destructive">{errors.ownerPassword.message}</p>}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Plan (optional)</label>
          <select
            {...register('planSlug')}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">No Plan</option>
            {plans?.map((plan: SubscriptionPlanResponse) => (
              <option key={plan.id} value={plan.slug}>{plan.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
          ) : (
            <><Building2 className="h-4 w-4" /> Create Organization</>
          )}
        </button>
      </form>
    </div>
  );
}
