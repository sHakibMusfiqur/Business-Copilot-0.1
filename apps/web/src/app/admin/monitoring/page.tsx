'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Heart,
  Mail,
  Server,
} from 'lucide-react';

import { getAdminDashboard } from '@/lib/api';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { ErrorState, LoadingState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';

const SERVICES = [
  { name: 'API Server', icon: Server, status: 'operational' as const, detail: 'Running on port 4000' },
  { name: 'Database', icon: Database, status: 'operational' as const, detail: 'PostgreSQL connected' },
  { name: 'Redis', icon: Activity, status: 'unknown' as const, detail: 'Not configured' },
  { name: 'Email Queue', icon: Mail, status: 'operational' as const, detail: 'Nodemailer active' },
  { name: 'File Storage', icon: HardDrive, status: 'operational' as const, detail: 'Local disk' },
  { name: 'Worker Processes', icon: Cpu, status: 'operational' as const, detail: 'Background tasks running' },
];



export default function AdminMonitoringPage() {
  const dash = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => getAdminDashboard(),
    staleTime: 30_000,
  });

  if (dash.isLoading || !dash.data) {
    return (
      <div className="space-y-4">
        <LoadingState rows={2} />
      </div>
    );
  }
  if (dash.isError) {
    return (
      <ErrorState
        message="Could not load monitoring data"
        onRetry={() => dash.refetch()}
      />
    );
  }

  const d = dash.data;
  const uptimeMs = d.platform?.uptimeMs ?? 0;
  const days = Math.floor(uptimeMs / 86400000);
  const hours = Math.floor((uptimeMs % 86400000) / 3600000);

  return (
    <div className="space-y-4">
      <PageHeader title="System Monitoring" description="Service health and infrastructure status" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Heart className="h-3.5 w-3.5" />
            <span className="text-[12px]">Health</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            <StatusBadge label="Operational" tone="success" dot />
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[12px]">Uptime</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {days > 0 ? `${days}d ${hours}h` : `${hours}h`}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            <span className="text-[12px]">Version</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            v{d.platform?.version ?? '0.1.0'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-[12px]">Errors Today</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {d.recentErrors?.length ?? 0}
          </p>
        </div>
      </div>

      <PanelCard title="Services" description="Health status of core services">
        <div className="space-y-2">
          {SERVICES.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <s.icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.detail}</p>
                </div>
              </div>
              <StatusBadge
                label={s.status === 'operational' ? 'Operational' : 'Unknown'}
                tone={s.status === 'operational' ? 'success' : 'neutral'}
                dot
              />
            </div>
          ))}
        </div>
      </PanelCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <PanelCard title="CPU & RAM" icon={Cpu}>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">CPU Usage</span>
                <span className="font-medium text-foreground">N/A</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: '0%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">RAM Usage</span>
                <span className="font-medium text-foreground">N/A</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: '0%' }} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            System metrics are not available from the current hosting environment.
          </p>
        </PanelCard>

        <PanelCard title="Database" icon={Database}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Engine</span>
              <span className="font-medium text-foreground">PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge label="Connected" tone="success" dot />
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Total Orgs</span>
              <span className="font-medium text-foreground">{d.organizations?.total ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Total Users</span>
              <span className="font-medium text-foreground">{d.users?.total ?? 0}</span>
            </div>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
