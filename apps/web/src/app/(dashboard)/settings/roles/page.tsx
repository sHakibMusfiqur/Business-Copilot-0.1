'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Shield, ShieldCheck, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { api, getRoles } from '@/lib/api';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PERMISSION_CATEGORIES = [
  { name: 'Users', permissions: ['Read', 'Create', 'Edit', 'Delete'] },
  { name: 'Sales', permissions: ['Read', 'Create', 'Edit', 'Delete'] },
  { name: 'Inventory', permissions: ['Read', 'Create', 'Edit', 'Delete'] },
  { name: 'Accounting', permissions: ['Read', 'Create', 'Edit', 'Delete'] },
  { name: 'Settings', permissions: ['Read', 'Create', 'Edit', 'Delete'] },
];

interface ExistingRole {
  id: string;
  name: string;
  description: string | null;
}

export default function RolesSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roles, setRoles] = useState<ExistingRole[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getRoles();
      const list = Array.isArray(data) ? (data as ExistingRole[]) : [];
      setRoles(list.slice(0, 20));
    } catch {
      setLoadError('Could not load existing roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const handleSave = async (data: FormData) => {
    setSaving(true);
    try {
      await api.post('/roles', { name: data.name.trim(), description: data.description?.trim() || undefined });
      const session = getOnboardingSession();
      if (session?.id) {
        try {
          await markChecklistComplete(session.id, 'roles');
        } catch {
          // best-effort
        }
      }
      setRoles((prev) => [...prev, { id: String(Date.now()), name: data.name.trim(), description: data.description?.trim() || null }]);
      form.reset({ name: '', description: '' });
      toast({ title: 'Role created', description: `Role "${data.name.trim()}" has been created.`, variant: 'success' });
    } catch (err) {
      toast({
        title: 'Could not create role',
        description: err instanceof Error ? err.message : 'Failed to create role.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupPageShell
      title="Roles & Permissions"
      description="Create roles and define what users can do in your workspace"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Roles & Permissions' },
      ]}
      onSave={() => void form.handleSubmit(handleSave)()}
      onCancel={() => router.back()}
      saving={saving}
      dirty={form.formState.isDirty}
    >
      {loadError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadRoles()}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      <SectionCard
        title="Create a Role"
        description="Define a role with specific permissions"
        icon={<Plus className="h-4 w-4" />}
      >
        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Role Name *
            </Label>
            <Input id="name" {...form.register('name')} placeholder="e.g. Finance Manager" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="What does this role do?"
              rows={3}
            />
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Creating...' : 'Create Role'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Available Permissions"
        description="Permissions can be assigned after role creation"
        icon={<ShieldCheck className="h-4 w-4" />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {PERMISSION_CATEGORIES.map((cat) => (
            <div key={cat.name} className="rounded-xl border border-slate-200/60 bg-muted/20 p-4 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{cat.name}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {cat.permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Existing Roles"
        description="Roles already configured for your workspace"
        icon={<Users className="h-4 w-4" />}
        badge={<span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{roles.length}</span>}
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : roles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200/60 px-5 py-10 text-center dark:border-white/10">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No roles created yet</p>
            <p className="text-xs text-muted-foreground">Create your first role above to start assigning permissions.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/60 dark:divide-white/10">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{role.name}</p>
                    {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </SetupPageShell>
  );
}
