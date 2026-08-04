'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Mail, Shield, Save } from 'lucide-react';
import { useState } from 'react';

import { getAdminSettings, updateAdminSetting, type ApiError } from '@/lib/api';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { AdminButton } from '@/components/admin/admin-button';
import { Switch } from '@/components/ui/switch';
import { ErrorState, LoadingState } from '@/components/admin/states';
import { toast } from '@/components/ui/use-toast';

const SMTP_FIELDS = [
  { key: 'smtp_host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
  { key: 'smtp_port', label: 'SMTP Port', type: 'number', placeholder: '587' },
  { key: 'smtp_user', label: 'SMTP Username', type: 'text', placeholder: 'user@gmail.com' },
  { key: 'smtp_pass', label: 'SMTP Password', type: 'password', placeholder: '••••••••' },
  { key: 'smtp_from', label: 'From Email', type: 'email', placeholder: 'noreply@example.com' },
] as const;

const APP_FIELDS = [
  { key: 'app_name', label: 'Application Name', type: 'text', placeholder: 'Business Copilot' },
  { key: 'app_url', label: 'Application URL', type: 'url', placeholder: 'https://copilot.example.com' },
  { key: 'support_email', label: 'Support Email', type: 'email', placeholder: 'support@example.com' },
] as const;

const BOOLEAN_SETTINGS = [
  { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Block all non-admin access to the platform.' },
] as const;

const MASKED = '••••••••';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => getAdminSettings(),
    staleTime: 30_000,
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirtyPass, setDirtyPass] = useState(false);

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => updateAdminSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast({ title: 'Setting updated' });
    },
    onError: (err: ApiError) => {
      setDraft({});
      setDirtyPass(false);
      toast({ title: err?.message ?? 'Failed to update', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <LoadingState rows={2} />;
  }

  if (isError) {
    return <ErrorState message="Could not load settings" onRetry={() => refetch()} />;
  }

  const getVal = (key: string) => {
    if (key === 'smtp_pass' && !dirtyPass) {
      return draft[key] ?? (settings?.[key] ? MASKED : '');
    }
    if (draft[key] !== undefined) return draft[key];
    const v = settings?.[key];
    if (v == null) return '';
    return String(v);
  };

  const saveText = (key: string, type: string) => {
    const v = draft[key];
    if (v === undefined) return;
    saveMutation.mutate({ key, value: type === 'number' ? Number(v) : v });
    setDraft((p) => { const n = { ...p }; delete n[key]; return n; });
    if (key === 'smtp_pass') setDirtyPass(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform Settings"
        description="Configure global platform behavior and integrations"
      />

      <PanelCard title="SMTP Configuration" icon={Mail} description="Email delivery settings">
        <div className="space-y-3">
          {SMTP_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{f.label}</label>
              <div className="flex gap-2">
                <input
                  type={f.type}
                  value={getVal(f.key)}
                  placeholder={f.placeholder}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, [f.key]: e.target.value }));
                    if (f.key === 'smtp_pass') setDirtyPass(true);
                  }}
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <AdminButton
                  variant="secondary"
                  size="sm"
                  onClick={() => saveText(f.key, f.type)}
                  disabled={draft[f.key] === undefined}
                >
                  <Save className="h-3.5 w-3.5" />
                </AdminButton>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard title="Application" icon={Settings} description="General platform settings">
        <div className="space-y-3">
          {APP_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{f.label}</label>
              <div className="flex gap-2">
                <input
                  type={f.type}
                  value={getVal(f.key)}
                  placeholder={f.placeholder}
                  onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <AdminButton
                  variant="secondary"
                  size="sm"
                  onClick={() => saveText(f.key, f.type)}
                  disabled={draft[f.key] === undefined}
                >
                  <Save className="h-3.5 w-3.5" />
                </AdminButton>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard title="Platform Control" icon={Shield}>
        <div className="space-y-3">
          {BOOLEAN_SETTINGS.map((b) => {
            const enabled = settings?.[b.key] === true || settings?.[b.key] === 'true';
            return (
              <div
                key={b.key}
                className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5"
              >
                <div>
                  <p className="text-[13px] font-medium text-foreground">{b.label}</p>
                  <p className="text-[12px] text-muted-foreground">{b.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={saveMutation.isPending}
                  onCheckedChange={(c) => saveMutation.mutate({ key: b.key, value: c })}
                />
              </div>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}
