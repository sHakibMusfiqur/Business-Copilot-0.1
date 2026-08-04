'use client';

import { useQuery } from '@tanstack/react-query';
import { Bot, Boxes, Coins, DatabaseZap, Sparkles } from 'lucide-react';

import { getAdminPlans } from '@/lib/api';
import { MetricList } from '@/components/admin/metric-list';
import { PageHeader } from '@/components/admin/page-header';
import { PanelCard } from '@/components/admin/panel-card';
import { EmptyState, LoadingState } from '@/components/admin/states';
import { StatusBadge } from '@/components/admin/status-badge';

const PROVIDERS = [
  { name: 'OpenAI', key: 'openai', description: 'GPT models · tokens · embeddings' },
  { name: 'Claude', key: 'claude', description: 'Anthropic Claude models' },
  { name: 'Gemini', key: 'gemini', description: 'Google Gemini models' },
];

export default function AdminAiUsagePage() {
  const plans = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => getAdminPlans(), staleTime: 60_000 });

  return (
    <div className="space-y-4">
      <PageHeader title="AI Usage" description="Model providers and token consumption" />

      <div className="grid gap-3 sm:grid-cols-3">
        <PanelCard title="Daily Usage" description="Tokens today">
          <EmptyState icon={Sparkles} title="No AI traffic" description="The AI pipeline is not yet recording usage." />
        </PanelCard>
        <PanelCard title="Monthly Usage" description="Tokens this month">
          <EmptyState icon={Coins} title="No AI traffic" description="Monthly token consumption will appear here." />
        </PanelCard>
        <PanelCard title="Estimated Cost" description="Across all providers">
          <EmptyState icon={DatabaseZap} title="No cost data" description="Provider cost tracking is not available yet." />
        </PanelCard>
      </div>

      <PanelCard title="Providers" description="AI model provider configuration">
        <div className="space-y-2">
          {PROVIDERS.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.description}</p>
                </div>
              </div>
              <StatusBadge label="Not configured" tone="neutral" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Provider API keys are managed in Platform Settings.
        </p>
      </PanelCard>

      <PanelCard title="AI Credits by Plan" description="Included monthly credits">
        {plans.isLoading ? (
          <LoadingState rows={3} />
        ) : (
          <MetricList
            items={(plans.data ?? []).map((p: { name: string; aiCredits: number }) => ({
              label: p.name,
              value: `${p.aiCredits} credits`,
            }))}
          />
        )}
      </PanelCard>

      <PanelCard title="Embedding Usage" icon={Boxes}>
        <EmptyState icon={Boxes} title="No embedding usage" description="Vector embedding consumption is not tracked yet." />
      </PanelCard>
    </div>
  );
}
