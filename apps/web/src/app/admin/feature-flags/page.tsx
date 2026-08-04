'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Loader2 } from 'lucide-react';

import { getAdminSettings, updateAdminSetting } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { ErrorState } from '@/components/admin/states';
import { toast } from '@/components/ui/use-toast';

const FLAGS = [
  { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the platform in maintenance mode. Only admins can access.' },
  { key: 'registration_enabled', label: 'Registration Enabled', description: 'Allow new users to register accounts.' },
  { key: 'ai_copilot', label: 'AI Copilot', description: 'Enable the AI assistant across all organizations.' },
  { key: 'email_verification', label: 'Email Verification', description: 'Require email verification for new accounts.' },
  { key: 'api_access', label: 'API Access', description: 'Enable external API access for all organizations.' },
  { key: 'white_label_branding', label: 'White Label Branding', description: 'Allow organizations to customize branding.' },
  { key: 'sales_invoices', label: 'Sales Invoices Module', description: 'Enable sales invoice management for all organizations.' },
  { key: 'multi_currency', label: 'Multi-Currency Support', description: 'Enable multi-currency transactions.' },
] as const;

export default function AdminFeatureFlagsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => getAdminSettings(),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => updateAdminSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast({ title: 'Flag updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update flag', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Could not load feature flags" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feature Flags"
        description="Toggle platform features on or off globally"
      />

      <PanelCard title="Global Feature Flags" icon={Flag} padded={false}>
        <div className="divide-y divide-border">
          {FLAGS.map((flag) => {
            const current = settings?.[flag.key];
            const enabled = current === true || current === 'true';

            return (
              <div
                key={flag.key}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">
                    {flag.label}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {flag.description}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={updateMutation.isPending}
                  onCheckedChange={(checked) =>
                    updateMutation.mutate({ key: flag.key, value: checked })
                  }
                />
              </div>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}
