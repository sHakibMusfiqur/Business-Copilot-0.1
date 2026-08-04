'use client';

import { useAuthStore } from '@/store/auth-store';
import { Shield, User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { AdminButton } from '@/components/admin/admin-button';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { MetricList } from '@/components/admin/metric-list';
import { StatusBadge } from '@/components/admin/status-badge';

export default function AdminProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Profile"
        description="Your platform administrator account"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Account Information" icon={User}>
          <div className="space-y-4">
        <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">
                  {user.name}
                </p>
                <p className="text-[13px] text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="h-px bg-border" />
            <MetricList
              items={[
                { label: 'Role', value: <StatusBadge label={user.role ?? 'SUPER_ADMIN'} tone="violet" /> },
                { label: 'User ID', value: <span className="font-mono text-[12px]">{user.id}</span> },
                { label: 'Last Login', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'N/A' },
                { label: 'Onboarding', value: user.onboardingCompleted ? 'Complete' : 'Incomplete' },
              ]}
            />
          </div>
        </PanelCard>

        <PanelCard title="Session" icon={Shield}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Shield className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-[13px] font-medium text-foreground">Authenticated</p>
                <p className="text-[12px] text-muted-foreground">Your session is active</p>
              </div>
            </div>

            <MetricList
              items={[
                { label: 'Token Type', value: 'JWT' },
                { label: 'Session Active', value: <StatusBadge label="Yes" tone="success" /> },
                { label: 'Two-Factor', value: <StatusBadge label="Not enabled" tone="neutral" /> },
              ]}
            />

            <div className="h-px bg-border" />

            <AdminButton
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Sign Out
            </AdminButton>
          </div>
        </PanelCard>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Sign Out"
        message="You will be redirected to the login page. Any unsaved changes will be lost."
        confirmLabel="Sign Out"
        tone="danger"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
