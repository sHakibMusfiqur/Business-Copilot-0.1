'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Loader2, Mail, Shield } from 'lucide-react';
import { useState } from 'react';

import { getAdminSettings, updateAdminSetting } from '@/lib/api';
import type { ApiError } from '@/lib/api';

const SETTING_KEYS = [
  { key: 'smtp_host', label: 'SMTP Host', icon: Mail, type: 'text' },
  { key: 'smtp_port', label: 'SMTP Port', icon: Mail, type: 'number' },
  { key: 'smtp_user', label: 'SMTP Username', icon: Mail, type: 'text' },
  { key: 'smtp_pass', label: 'SMTP Password', icon: Mail, type: 'password' },
  { key: 'smtp_from', label: 'SMTP From Email', icon: Mail, type: 'email' },
  { key: 'app_name', label: 'Application Name', icon: Settings, type: 'text' },
  { key: 'app_url', label: 'Application URL', icon: Settings, type: 'url' },
  { key: 'support_email', label: 'Support Email', icon: Mail, type: 'email' },
  { key: 'maintenance_mode', label: 'Maintenance Mode', icon: Shield, type: 'boolean' },
];

const MASKED_PASSWORD = '••••••••';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: getAdminSettings,
    staleTime: 30_000,
  });

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [smtpPassChanged, setSmtpPassChanged] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => updateAdminSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setToast({ type: 'success', message: 'Setting updated successfully' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err: ApiError) => {
      // Rollback UI for boolean toggles
      setLocalValues({});
      setSmtpPassChanged(false);
      setToast({ type: 'error', message: err?.message ?? 'Failed to update setting' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getValue = (key: string) => {
    if (key === 'smtp_pass' && !smtpPassChanged) {
      const stored = localValues[key] ?? (settings?.[key] ? MASKED_PASSWORD : '');
      return stored;
    }
    if (localValues[key] !== undefined) return localValues[key];
    const val = settings?.[key];
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {toast && (
        <div className={`rounded-lg p-3 text-sm ${
          toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
        }`}>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure global platform settings</p>
      </div>

      <div className="space-y-4">
        {SETTING_KEYS.map((setting) => (
          <div key={setting.key} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <setting.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">{setting.label}</label>
                  <p className="text-xs text-muted-foreground">{setting.key}</p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              {setting.type === 'boolean' ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const current = getValue(setting.key) === 'true';
                      const newVal = String(!current);
                      setLocalValues((prev) => ({ ...prev, [setting.key]: newVal }));
                      updateMutation.mutate({ key: setting.key, value: newVal === 'true' });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      getValue(setting.key) === 'true' ? 'bg-primary' : 'bg-muted'
                    }`}
                    aria-label={`Toggle ${setting.label}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        getValue(setting.key) === 'true' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {getValue(setting.key) === 'true' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type={setting.type}
                    value={getValue(setting.key)}
                    onChange={(e) => {
                      setLocalValues((prev) => ({ ...prev, [setting.key]: e.target.value }));
                      if (setting.key === 'smtp_pass') setSmtpPassChanged(true);
                    }}
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={setting.label}
                  />
                  <button
                    onClick={() => {
                      const val = localValues[setting.key];
                      if (val !== undefined) {
                        updateMutation.mutate({ key: setting.key, value: setting.type === 'number' ? Number(val) : val });
                        setLocalValues((prev) => {
                          const next = { ...prev };
                          delete next[setting.key];
                          return next;
                        });
                        if (setting.key === 'smtp_pass') setSmtpPassChanged(false);
                      }
                    }}
                    disabled={localValues[setting.key] === undefined}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    aria-label={`Save ${setting.label}`}
                  >
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
