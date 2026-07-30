'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { api, getRoles } from '@/lib/api';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
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
  const [saved, setSaved] = useState(false);
  const [roles, setRoles] = useState<ExistingRole[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    getRoles().then((data: unknown) => {
      if (Array.isArray(data)) setRoles(data.slice(0, 5));
    }).catch(() => {});
  }, []);

  const handleSave = async (data: FormData) => {
    setSaving(true);
    try {
      await api.post('/roles', { name: data.name, description: data.description });
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'roles');
      }
      setRoles((prev) => [...prev, { id: String(Date.now()), name: data.name, description: data.description ?? null }]);
      form.reset({ name: '', description: '' });
      setSaved(true);
      toast({ title: 'Role created', description: `Role "${data.name}" has been created.`, variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create role.', variant: 'destructive' });
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
      onSave={async () => {
        if (roles.length > 0) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      }}
      onCancel={() => router.back()}
      saved={saved}
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Create a Role</h3>
          <p className="text-xs text-muted-foreground mt-1">Define a role with specific permissions</p>
        </div>

        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Role Name *</Label>
            <Input id="name" {...form.register('name')} placeholder="e.g. Finance Manager" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} placeholder="What does this role do?" rows={3} />
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Creating...' : 'Create Role'}
          </Button>
        </form>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Available Permissions</h3>
          <p className="text-xs text-muted-foreground mt-1">Permissions can be assigned after role creation</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERMISSION_CATEGORIES.map((cat) => (
            <Card key={cat.name}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{cat.name}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cat.permissions.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px] opacity-60">
                      {p}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {roles.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Existing Roles ({roles.length})</h3>
            <div className="space-y-2">
              {roles.map((role) => (
                <Card key={role.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{role.name}</p>
                        {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                      </div>
                    </div>
                    <Badge variant="secondary">Existing</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </SetupPageShell>
  );
}
