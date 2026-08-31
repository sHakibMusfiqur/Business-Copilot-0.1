'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Phone,
  Mail,
  Users,
  ClipboardList,
  CalendarClock,
  CheckCircle2,
  Trash2,
  Plus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { CRM_CREATE, CRM_UPDATE, CRM_DELETE } from '@/lib/permissions';
import { getLeadById, getLeadTimeline, getLeadActivities, toggleActivity, deleteActivity } from '@/lib/api';
import { formatDate, formatCurrency, formatDateTime, generateInitials } from '@/lib/utils';
import type {
  Lead,
  TimelineEvent,
  Activity,
  TimelineResponse,
  ActivityListResponse,
} from '@/components/crm/crm-types';
import { LEAD_STATUS_STYLES, ACTIVITY_TYPE_STYLES } from '@/components/crm/crm-types';
import { CreateActivityDialog } from '@/components/crm/create-activity-dialog';

const activityTypeIcon: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  TASK: ClipboardList,
  NOTE: ClipboardList,
};

const timelineTypeIcon: Record<string, typeof CalendarClock> = {
  CREATED: CalendarClock,
  STATUS_CHANGE: CalendarClock,
  ASSIGNED: Users,
  ACTIVITY_ADDED: ClipboardList,
};

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isLoaded } = usePermissions();
  const leadId = params.id as string;

  const canCreate = isLoaded && hasPermission(CRM_CREATE);
  const canUpdate = isLoaded && hasPermission(CRM_UPDATE);
  const canDelete = isLoaded && hasPermission(CRM_DELETE);

  const [activityOpen, setActivityOpen] = useState(false);

  const leadQuery = useQuery<Lead>({
    queryKey: ['crm', 'lead', leadId],
    queryFn: () => getLeadById(leadId),
    enabled: !!leadId,
  });

  const timelineQuery = useQuery<TimelineResponse>({
    queryKey: ['crm', 'lead', leadId, 'timeline'],
    queryFn: () => getLeadTimeline(leadId),
    enabled: !!leadId,
  });

  const activitiesQuery = useQuery<ActivityListResponse>({
    queryKey: ['crm', 'lead', leadId, 'activities'],
    queryFn: () => getLeadActivities(leadId),
    enabled: !!leadId,
  });

  const toggleMutation = useMutation({
    mutationFn: (activityId: string) => toggleActivity(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'lead', leadId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'summary'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: string) => deleteActivity(activityId),
    onSuccess: () => {
      toast({ title: 'Activity deleted' });
      queryClient.invalidateQueries({ queryKey: ['crm', 'lead', leadId, 'activities'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const invalidateActivities = () => {
    queryClient.invalidateQueries({ queryKey: ['crm', 'lead', leadId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'lead', leadId, 'timeline'] });
    queryClient.invalidateQueries({ queryKey: ['crm', 'summary'] });
    setActivityOpen(false);
  };

  if (leadQuery.isLoading) return <DetailSkeleton />;

  if (leadQuery.isError) {
    return (
      <DashboardError
        message={leadQuery.error instanceof Error ? leadQuery.error.message : undefined}
        onRetry={() => leadQuery.refetch()}
      />
    );
  }

  const lead = leadQuery.data as Lead;
  const timeline = timelineQuery.data?.data ?? [];
  const activities = activitiesQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEAD_STATUS_STYLES[lead.status]}`}>
              {lead.status.charAt(0) + lead.status.slice(1).toLowerCase()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {lead.leadNumber} &middot; {lead.company ?? 'No company'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Activities
              </h2>
              {canCreate && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setActivityOpen(true)}>
                  <Plus className="h-3 w-3" />
                  Add Activity
                </Button>
              )}
            </div>

            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No activities yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity: Activity) => {
                  const Icon = activityTypeIcon[activity.type] ?? ClipboardList;
                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                      <div className={`rounded-lg p-1.5 mt-0.5 ${ACTIVITY_TYPE_STYLES[activity.type] ?? 'bg-muted text-muted-foreground'}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${activity.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {activity.title}
                          </p>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTIVITY_TYPE_STYLES[activity.type]}`}>
                            {activity.type.charAt(0) + activity.type.slice(1).toLowerCase()}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(activity.createdAt)}
                          </span>
                          {activity.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              Due {formatDate(activity.dueDate)}
                            </span>
                          )}
                          {activity.createdBy && (
                            <span className="text-xs text-muted-foreground">
                              by {activity.createdBy.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => toggleMutation.mutate(activity.id)}
                            className={`rounded p-1 transition-colors ${
                              activity.completed
                                ? 'text-emerald-500 hover:text-emerald-600'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => deleteActivityMutation.mutate(activity.id)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete activity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Timeline
            </h2>

            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No timeline events yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                <div className="space-y-4">
                  {timeline.map((event: TimelineEvent) => {
                    const Icon = timelineTypeIcon[event.type] ?? CalendarClock;
                    return (
                      <div key={event.id} className="flex items-start gap-3 relative">
                        <div className="z-10 rounded-full border bg-card p-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm">{event.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(event.createdAt)}
                            </span>
                            {event.createdBy && (
                              <>
                                <span className="text-xs text-muted-foreground">&middot;</span>
                                <span className="text-xs text-muted-foreground">
                                  {event.createdBy.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold mb-4">Lead Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Name</p>
                <p className="text-sm font-medium">{lead.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Company</p>
                <p className="text-sm">{lead.company ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-sm">{lead.email ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Phone</p>
                <p className="text-sm">{lead.phone ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Source</p>
                <p className="text-sm">{lead.source ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Estimated Value</p>
                <p className="text-sm font-medium">{formatCurrency(Number(lead.estimatedValue))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEAD_STATUS_STYLES[lead.status]}`}>
                  {lead.status.charAt(0) + lead.status.slice(1).toLowerCase()}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {lead.assignedTo ? generateInitials(lead.assignedTo.name) : '?'}
                  </div>
                  <span className="text-sm">{lead.assignedTo?.name ?? 'Unassigned'}</span>
                </div>
              </div>
              {lead.convertedToCustomer && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Converted To</p>
                  <p className="text-sm text-primary font-medium">{lead.convertedToCustomer.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <p className="text-sm">{formatDateTime(lead.createdAt)}</p>
              </div>
              {lead.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{lead.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateActivityDialog
        leadId={lead.id}
        leadLabel={`${lead.leadNumber} - ${lead.name}`}
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        onCreated={invalidateActivities}
      />
    </div>
  );
}
