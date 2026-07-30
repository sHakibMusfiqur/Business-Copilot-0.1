'use client';

import { AlertCircle, RefreshCw, Lock, SearchX, ServerCrash, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

const STATUS_MESSAGES: Record<number, { title: string; message: string; icon: typeof AlertCircle }> = {
  401: {
    title: 'Session expired',
    message: 'Your session has expired. Please log in again.',
    icon: Lock,
  },
  403: {
    title: 'Access denied',
    message: 'You do not have access to this dashboard.',
    icon: Lock,
  },
  404: {
    title: 'Not found',
    message: 'The requested data was not found.',
    icon: SearchX,
  },
  500: {
    title: 'Server error',
    message: 'An unexpected error occurred. Please try again.',
    icon: ServerCrash,
  },
};

interface DashboardErrorProps {
  status?: number;
  message?: string;
  onRetry?: () => void;
}

function getErrorMessage(status: number | undefined, message: string | undefined): { title: string; message: string; icon: typeof AlertCircle } {
  if (status && STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status];
  }
  return {
    title: 'Failed to load dashboard',
    message: message ?? 'An unexpected error occurred. Please try again.',
    icon: AlertCircle,
  };
}

export function DashboardError({ status, message, onRetry }: DashboardErrorProps) {
  const { title, message: displayMessage, icon: Icon } = getErrorMessage(status, message);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-5">
        <Icon className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
        {displayMessage}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} className="gap-2 rounded-xl">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
        <Button asChild variant="outline" className="gap-2 rounded-xl">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
