'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { getSessionByEmail, getChecklistProgress } from '@/lib/onboarding-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function OnboardingWidget() {
  const user = useAuthStore((s) => s.user);
  const userEmail = user?.email;

  const sessionQuery = useQuery({
    queryKey: ['onboarding', 'session', userEmail],
    queryFn: () => getSessionByEmail(userEmail as string),
    enabled: !!userEmail,
    retry: false,
    staleTime: 60000,
  });

  const session = sessionQuery.data;
  const sessionId = session?.id;

  const checklistQuery = useQuery({
    queryKey: ['onboarding', 'checklist-progress', sessionId],
    queryFn: () => getChecklistProgress(sessionId as string),
    enabled: !!sessionId && session?.provisionStatus === 'COMPLETED',
    staleTime: 30000,
  });

  if (sessionQuery.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin" />
            Onboarding
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!session) return null;

  if (session.provisionStatus === 'PENDING' || session.provisionStatus === 'PROVISIONING') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-amber-500" />
            Onboarding In Progress
          </CardTitle>
          <CardDescription>Complete your setup to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Step {session.currentStep} of 11
          </p>
          <Button asChild size="sm" className="w-full">
            <Link href="/onboarding">
              Resume Onboarding
              <ArrowRight className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (session.provisionStatus === 'COMPLETED' && checklistQuery.data) {
    const { total, completed, percentage } = checklistQuery.data;

    if (total === 0) return null;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-emerald-500" />
            Getting Started Checklist
          </CardTitle>
          <CardDescription>{completed}/{total} tasks complete</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percentage}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{percentage}% complete</p>
          {percentage < 100 && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/onboarding/success?sessionId=${session.id}`}>
                View Checklist
                <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
