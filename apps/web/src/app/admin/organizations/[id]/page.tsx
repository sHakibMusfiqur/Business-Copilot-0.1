'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Package,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Users,
  UserSquare,
  Wallet,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  activateOrganization,
  deleteAdminOrganization,
  getAdminOrganization,
  getAdminOrganizationStatistics,
  restoreAdminOrganization,
  suspendOrganization,
} from '@/lib/api';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { ActivityList } from '@/components/admin/activity-list';
import { AdminButton } from '@/components/admin/admin-button';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { MetricList } from '@/components/admin/metric-list';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { ErrorState, LoadingState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';
import { toast } from '@/components/ui/use-toast';

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<{ type: 'suspend' | 'activate' | 'delete' | 'restore' } | null>(null);

  const detail = useQuery({
    queryKey: ['admin', 'org', id],
    queryFn: () => getAdminOrganization(id),
    enabled: Boolean(id),
  });

  const stats = useQuery({
    queryKey: ['admin', 'org-stats', id],
    queryFn: () => getAdminOrganizationStatistics(id),
    enabled: Boolean(id),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'org', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'org-stats', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };

  const suspend = useMutation({ mutationFn: suspendOrganization, onSuccess: () => { invalidate(); setConfirm(null); toast({ title: 'Organization suspended' }); }, onError: (e: Error) => { setConfirm(null); toast({ title: e.message, variant: 'destructive' }); } });
  const activate = useMutation({ mutationFn: activateOrganization, onSuccess: () => { invalidate(); setConfirm(null); toast({ title: 'Organization activated' }); }, onError: (e: Error) => { setConfirm(null); toast({ title: e.message, variant: 'destructive' }); } });
  const remove = useMutation({ mutationFn: (orgId: string) => deleteAdminOrganization(orgId), onSuccess: () => { invalidate(); setConfirm(null); toast({ title: 'Organization deleted' }); }, onError: (e: Error) => { setConfirm(null); toast({ title: e.message, variant: 'destructive' }); } });
  const restore = useMutation({ mutationFn: (orgId: string) => restoreAdminOrganization(orgId), onSuccess: () => { invalidate(); setConfirm(null); toast({ title: 'Organization restored' }); }, onError: (e: Error) => { setConfirm(null); toast({ title: e.message, variant: 'destructive' }); } });

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.type === 'suspend') suspend.mutate(id);
    else if (confirm.type === 'activate') activate.mutate(id);
    else if (confirm.type === 'restore') restore.mutate(id);
    else remove.mutate(id);
  };

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingState rows={2} />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return <ErrorState message="Could not load organization" onRetry={() => detail.refetch()} />;
  }

  const org = detail.data;
  const s = stats.data;
  const deleted = Boolean(org.deletedAt);
  const archived = !deleted && Boolean(org.archivedAt);
  const suspended = !deleted && !archived && Boolean(org.suspendedAt);
  const statusLabel = deleted ? 'Deleted' : archived ? 'Archived' : suspended ? 'Suspended' : 'Active';
  const statusTone = deleted || suspended ? 'warning' : 'success';

  return (
    <div className="space-y-4">
      <Link href="/admin/organizations" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Organizations
      </Link>

      <PageHeader
        title={org.name}
        description={`${org.slug} · created ${formatDate(org.createdAt)}`}
        actions={
          <>
            <StatusBadge label={statusLabel} tone={statusTone} dot />
            {deleted ? (
              <AdminButton variant="outline" loading={restore.isPending} onClick={() => setConfirm({ type: 'restore' })}>
                <RotateCcw className="h-3.5 w-3.5" /> Restore
              </AdminButton>
            ) : suspended ? (
              <AdminButton variant="outline" loading={activate.isPending} onClick={() => setConfirm({ type: 'activate' })}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Activate
              </AdminButton>
            ) : (
              <AdminButton variant="outline" loading={suspend.isPending} onClick={() => setConfirm({ type: 'suspend' })}>
                <XCircle className="h-3.5 w-3.5" /> Suspend
              </AdminButton>
            )}
            {!deleted && (
              <AdminButton variant="danger" loading={remove.isPending} onClick={() => setConfirm({ type: 'delete' })}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </AdminButton>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Employees', value: formatNumber(org._count?.users ?? 0), icon: Users },
          { label: 'Members', value: formatNumber(org._count?.members ?? 0), icon: UserSquare },
          { label: 'Customers', value: formatNumber(s?.usage?.customers ?? org._count?.customers ?? 0), icon: Users },
          { label: 'Products', value: formatNumber(s?.usage?.products ?? org._count?.products ?? 0), icon: Package },
          { label: 'Suppliers', value: formatNumber(s?.usage?.suppliers ?? org._count?.suppliers ?? 0), icon: ShoppingCart },
          { label: 'Invoices', value: formatNumber(s?.usage?.invoices ?? org._count?.invoices ?? 0), icon: FileText },
          { label: 'Revenue', value: formatCurrency(s?.revenue?.total ?? 0), icon: Wallet },
          { label: 'Audit Events', value: formatNumber(s?.usage?.auditEvents ?? org._count?.invoices ?? 0), icon: Activity },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <m.icon className="h-3.5 w-3.5" />
              <span className="text-[12px]">{m.label}</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Owner" icon={Users}>
          <MetricList
            items={[
              { label: 'Name', value: org.owner?.name ?? '—' },
              { label: 'Email', value: org.owner?.email ?? '—' },
            ]}
          />
        </PanelCard>
        <PanelCard title="Subscription" icon={CreditCard}>
          <MetricList
            items={[
              { label: 'Plan', value: org.subscription?.plan?.name ?? 'No plan' },
              { label: 'Status', value: <StatusBadge label={org.subscription?.status ?? 'None'} tone={org.subscription?.status === 'ACTIVE' ? 'success' : 'neutral'} /> },
              { label: 'Period ends', value: s?.subscription?.currentPeriodEnd ? formatDate(s.subscription.currentPeriodEnd) : '—' },
            ]}
          />
        </PanelCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="Employee Activity" icon={Activity}>
          {s ? (
            <MetricList
              dense
              items={[
                { label: 'Active users', value: s.users.active },
                { label: 'Inactive users', value: s.users.inactive },
                { label: 'Total logins', value: formatNumber(s.users.totalLogins) },
                { label: 'Logins this month', value: formatNumber(s.users.monthlyLogins) },
              ]}
            />
          ) : (
            <div className="py-6 text-center text-[13px] text-muted-foreground">Statistics unavailable</div>
          )}
        </PanelCard>
        <PanelCard title="Recent Activity" description="Last audit events">
          {s?.recentActivities?.length ? (
            <ActivityList
              limit={8}
              items={s.recentActivities.map((a) => ({
                id: a.id,
                title: a.action,
                description: a.entity ? `Entity: ${a.entity}` : undefined,
                meta: a.user?.email,
                icon: Activity,
                tone: 'neutral',
                timestamp: a.createdAt,
              }))}
            />
          ) : (
            <div className="py-10 text-center text-[13px] text-muted-foreground">No activity recorded</div>
          )}
        </PanelCard>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.type === 'suspend' ? 'Suspend Organization'
          : confirm?.type === 'activate' ? 'Activate Organization'
          : confirm?.type === 'restore' ? 'Restore Organization'
          : 'Delete Organization'
        }
        message={
          confirm?.type === 'suspend' ? 'This will deactivate the organization and block all member access.'
          : confirm?.type === 'activate' ? 'This will reactivate the organization and restore access.'
          : confirm?.type === 'restore' ? 'This will restore the soft-deleted organization.'
          : 'This soft-deletes the organization. Data can be restored later.'
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete' : confirm?.type === 'restore' ? 'Restore' : 'Confirm'}
        loading={suspend.isPending || activate.isPending || remove.isPending || restore.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
