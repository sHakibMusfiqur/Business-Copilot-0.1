export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE';

export interface LeadAssignedTo {
  id: string;
  name: string;
}

export interface LeadListItem {
  id: string;
  leadNumber: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  estimatedValue: number;
  assignedToId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: LeadAssignedTo | null;
  activityCount: number;
}

export interface Lead {
  id: string;
  leadNumber: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  estimatedValue: number;
  assignedToId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: LeadAssignedTo | null;
  convertedToCustomer: { id: string; name: string } | null;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  lead: { id: string; leadNumber: string; name: string } | null;
}

export interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  metadata: unknown;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface LeadSummary {
  totalLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  lostLeads: number;
  pipelineValue: number;
  conversionRate: number;
  upcomingActivities: Activity[];
}

export interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadListResponse {
  data: LeadListItem[];
  meta: Meta;
}

export interface TimelineResponse {
  data: TimelineEvent[];
}

export interface ActivityListResponse {
  data: Activity[];
  meta: Meta;
}

export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONTACTED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  QUALIFIED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WON: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const ACTIVITY_TYPE_STYLES: Record<ActivityType, string> = {
  CALL: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  EMAIL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MEETING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  TASK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NOTE: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};
