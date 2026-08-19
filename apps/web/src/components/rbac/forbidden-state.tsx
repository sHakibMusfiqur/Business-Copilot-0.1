'use client';

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';


export function ForbiddenState({
  title = 'Access restricted',
  description = "You don't have permission to access this area.",
  backHref = '/dashboard',
}: {
  title?: string;
  description?: string;
  backHref?: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <p className="mt-4 text-base font-semibold tracking-tight text-foreground">403 · {title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" asChild>
          <Link href={backHref}>Go to Dashboard</Link>
        </Button>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    </div>
  );
}