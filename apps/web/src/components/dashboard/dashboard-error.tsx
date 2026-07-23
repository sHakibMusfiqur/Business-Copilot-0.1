'use client';

import { AlertCircle, RefreshCw, Lock, SearchX, ServerCrash } from 'lucide-react';

import { Button } from '@/components/ui/button';

const STATUS_MESSAGES: Record<number, { title: string; message: string; icon: typeof AlertCircle }> = {
  401: {
    title: 'Session expired',
    message: 'Your session has expired. Please log in again.',
    icon: Lock,
  },
  403: {
    title: 'Access denied',
    message: 'You do not have access to this dashboard. You need to be a member of an organization.',
    icon: Lock,
  },
  404: {
    title: 'Not found',
    message: 'The requested organization was not found.',
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <Icon className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {displayMessage}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
