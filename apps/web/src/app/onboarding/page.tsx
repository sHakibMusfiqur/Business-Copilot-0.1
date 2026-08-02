'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { getMe } from '@/lib/api';
import { getSessionByEmail } from '@/lib/onboarding-api';
import { useAuthStore } from '@/store/auth-store';

export default function OnboardingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = searchParams.get('session');
  const storeEmail = useAuthStore((s) => s.user?.email);
  const [noSession, setNoSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // A session id in the URL is authoritative -> forward straight to Verify.
      if (session) {
        router.replace(`/onboarding/verify?session=${session}`);
        return;
      }

      // Otherwise try to restore the authenticated user's existing session so we
      // never render Verify without a valid session id.
      let email: string | null = storeEmail ?? null;
      if (!email) {
        try {
          const me = await getMe();
          email = me?.email ?? null;
        } catch {
          email = null;
        }
      }

      if (cancelled) return;

      if (email) {
        try {
          const restored = await getSessionByEmail(email);
          if (!cancelled && restored?.id) {
            router.replace(`/onboarding/verify?session=${restored.id}`);
            return;
          }
        } catch {
          // No session (or not permitted) -> fall through to the start state.
        }
      }

      if (!cancelled) setNoSession(true);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [session, storeEmail, router]);

  if (!noSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  // No onboarding session exists. Show a start prompt instead of forwarding to
  // /onboarding/verify (which would render "No session found.").
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass-card max-w-md rounded-2xl p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold">Onboarding</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          No onboarding session was found. Start a new workspace to begin.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start setup
          </Link>
          <Link
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
