'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Loader2, MailPlus, RefreshCw, Send, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { createInvitation, getInvitations, revokeInvitation, resendInvitation } from '@/lib/api';
import { generateInitials } from '@/lib/utils';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { queryClient } from '@/lib/query-client';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

export default function MembersPage() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const invitationsQuery = useQuery({
    queryKey: ['invitations'],
    queryFn: () => getInvitations(),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: FormData) => createInvitation({ name: data.name.trim(), email: data.email.trim() }),
    onSuccess: async (data) => {
      const session = getOnboardingSession();
      if (session?.id) {
        try {
          await markChecklistComplete(session.id, 'team');
        } catch {
          // best-effort
        }
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
      }
      toast({
        title: 'Invitation sent',
        description: data.message,
        variant: 'success',
      });
      if (!data.emailSent && data.inviteUrl) {
        toast({
          title: 'No SMTP configured',
          description: `Share this invite link: ${data.inviteUrl}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      reset({ name: '', email: '' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not send invitation',
        description: error.message ?? 'Failed to send invitation.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      sendingRef.current = false;
      setSending(false);
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => resendInvitation(id),
    onSuccess: (data) => {
      toast({
        title: 'Invitation resent',
        description: data.emailSent ? 'A new invitation email was sent.' : 'No SMTP configured.',
      });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not resend invitation', description: error.message, variant: 'destructive' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      toast({ title: 'Invitation revoked', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not revoke invitation', description: error.message, variant: 'destructive' });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  const { register, handleSubmit, reset, formState } = form;

  const handleInvite = (data: FormData) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    inviteMutation.mutate(data);
  };

  const members = invitationsQuery.data ?? [];

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
        badge={
          members.length > 0 ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {members.length}
            </span>
          ) : undefined
        }
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
              <div key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {generateInitials(m.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.expired ? (
                    <span className="text-xs font-medium text-destructive">Expired</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <Send className="h-3 w-3" /> Invited
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-muted-foreground"
                    onClick={() => resendMutation.mutate(m.id)}
                    disabled={resendMutation.isPending || m.expired}
                  >
                    <RefreshCw className="h-3 w-3" /> Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => revokeMutation.mutate(m.id)}
                    disabled={revokeMutation.isPending || m.expired}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </SetupPageShell>
  );
}
