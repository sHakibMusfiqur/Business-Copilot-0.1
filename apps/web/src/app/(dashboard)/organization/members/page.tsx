'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  role: z.string().min(1, 'Select a role'),
});

type FormData = z.infer<typeof schema>;

const ROLES = ['Admin', 'Manager', 'Member', 'Viewer'];

interface Member {
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'sent';
}

export default function MembersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: 'Member' },
  });

  const { register, handleSubmit, reset, formState: { errors } } = form;

  const handleInvite = async (data: FormData) => {
    setSaving(true);
    try {
      await api.post('/invitations', { name: data.name, email: data.email, role: data.role });
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'team');
      }
      setMembers((prev) => [...prev, { name: data.name, email: data.email, role: data.role, status: 'sent' }]);
      reset({ name: '', email: '', role: 'Member' });
      setSaved(true);
      toast({ title: 'Invitation sent', description: `An invitation has been sent to ${data.email}.`, variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to send invitation.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupPageShell
      title="Team Members"
      description="Invite your team members to collaborate in your workspace"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Organization' },
        { label: 'Members' },
      ]}
      onSave={async () => {
        if (members.length > 0) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      }}
      onCancel={() => router.back()}
      saved={saved}
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Invite a Member</h3>
          <p className="text-xs text-muted-foreground mt-1">Send an invitation to a new team member</p>
        </div>

        <form onSubmit={handleSubmit(handleInvite)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" {...register('name')} placeholder="John Doe" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input id="email" type="email" {...register('email')} placeholder="john@company.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <select id="role" {...register('role')} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>
      </div>

      {members.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Pending Invitations ({members.length})</h3>
            <div className="space-y-2">
              {members.map((m) => (
                <Card key={m.email}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{m.role}</span>
                      <span className="flex items-center gap-1 text-xs text-emerald-500">
                        <Check className="h-3 w-3" /> Invited
                      </span>
                    </div>
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
