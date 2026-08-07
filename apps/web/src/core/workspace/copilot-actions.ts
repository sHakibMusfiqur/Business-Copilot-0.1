'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useShellStore } from '@/core/layout/shell-store';

const COMMAND_ROUTES: Record<string, string> = {
  'invoice.create': '/sales',
  'invoice.open': '/sales',
  'customer.create': '/customers',
  'purchase.create': '/purchases',
  'order.create': '/sales',
  'employee.create': '/users',
  'leave.approve': '/users',
  'leave.request': '/users',
  'approvals.list': '/dashboard',
  'reports.generate': '/dashboard',
  'reports.export': '/dashboard',
  'reports.analyze': '/dashboard',
  'payment.create': '/accounting/payments',
  'inventory.adjust': '/inventory',
  'org.create': '/dashboard',
  'user.invite': '/users',
  'import.csv': '/customers',
};

/**
 * Routes an executable command from the AI copilot / command palette / quick
 * actions to the relevant module page (or opens the AI panel for AI commands).
 */
export function useCopilotActions() {
  const router = useRouter();
  const setAiPanelOpen = useShellStore((s) => s.setAiPanelOpen);

  return useCallback(
    (command: string) => {
      if (command.startsWith('ai.')) {
        setAiPanelOpen(true);
        return;
      }
      router.push(COMMAND_ROUTES[command] ?? '/dashboard');
    },
    [router, setAiPanelOpen],
  );
}
