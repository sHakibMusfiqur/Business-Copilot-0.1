'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, MailPlus, Send, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { api } from '@/lib/api';
import { generateInitials } from '@/lib/utils';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { queryClient } from '@/lib/query-client';

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
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: 'Member' },
  });

  const { register, handleSubmit, reset, formState } = form;

  const handleInvite = async (data: FormData) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await api.post('/invitations', { name: data.name.trim(), email: data.email.trim(), role: data.role });
    } catch (err) {
      if (mountedRef.current) {
        toast({
          title: 'Could not send invitation',
          description: err instanceof Error ? err.message : 'Failed to send invitation.',
          variant: 'destructive',
        });
      }
      sendingRef.current = false;
      if (mountedRef.current) setSending(false);
      return;
    }

    const session = getOnboardingSession();
    if (session?.id) {
      try {
        await markChecklistComplete(session.id, 'team');
      } catch {
        // best-effort
      }
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
    }

    if (!mountedRef.current) {
      sendingRef.current = false;
      return;
    }
    setMembers((prev) => [
      ...prev,
      { name: data.name.trim(), email: data.email.trim(), role: data.role, status: 'sent' },
    ]);
    reset({ name: '', email: '', role: 'Member' });
    toast({ title: 'Invitation sent', description: `An invitation has been sent to ${data.email.trim()}.`, variant: 'success' });
    sendingRef.current = false;
    if (mountedRef.current) setSending(false);
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
      onSave={() => undefined}
      hideSaveBar
    >
      <SectionCard
        title="Invite a Member"
        description="Send an invitation to a new team member"
        icon={<UserPlus className="h-4 w-4" />}
      >
        <form onSubmit={handleSubmit(handleInvite)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Full Name *
              </Label>
              <Input id="name" {...register('name')} placeholder="John Doe" />
              {formState.errors.name && (
                <p className="text-xs text-destructive">{formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address *
              </Label>
              <Input id="email" type="email" {...register('email')} placeholder="john@company.com" />
              {formState.errors.email && (
                <p className="text-xs text-destructive">{formState.errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="max-w-sm space-y-2">
            <Label htmlFor="role" className="text-sm font-medium">
              Role *
            </Label>
            <select
              id="role"
              {...register('role')}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {formState.errors.role && (
              <p className="text-xs text-destructive">{formState.errors.role.message}</p>
            )}
          </div>

          <Button type="submit" disabled={sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Pending Invitations"
        description="Members who have been invited to join your workspace"
        icon={<MailPlus className="h-4 w-4" />}
        badge={members.length > 0 ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{members.length}</span> : undefined}
      >
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200/60 px-5 py-10 text-center dark:border-white/10">
            <MailPlus className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No invitations sent yet</p>
            <p className="text-xs text-muted-foreground">Invite your first team member to start collaborating.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/60 dark:divide-white/10">
            {members.map((m) => (
              <div key={m.email} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {generateInitials(m.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <Send className="h-3 w-3" /> Invited
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </SetupPageShell>
  );
}
