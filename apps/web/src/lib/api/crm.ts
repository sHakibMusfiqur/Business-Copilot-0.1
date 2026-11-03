import { api } from './client';
import { API_ROUTES } from './routes';

export interface CrmLeadsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  assignedToId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getCrmSummary(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.CRM.SUMMARY, { signal });
  return response.data;
}

export async function getLeads(params?: CrmLeadsListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.CRM.LEADS, { params, signal });
  return response.data;
}

export async function getLeadById(id: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.CRM.LEADS}/${id}`, { signal });
  return response.data;
}

export async function createLead(data: {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: string;
  estimatedValue?: number;
  assignedToId?: string;
  notes?: string;
}) {
  const response = await api.post(API_ROUTES.CRM.LEADS, data);
  return response.data;
}

export async function updateLead(
  id: string,
  data: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: string;
    estimatedValue?: number;
    assignedToId?: string;
    notes?: string;
  },
) {
  const response = await api.patch(`${API_ROUTES.CRM.LEADS}/${id}`, data);
  return response.data;
}

export async function deleteLead(id: string) {
  const response = await api.delete(`${API_ROUTES.CRM.LEADS}/${id}`);
  return response.data;
}

export async function updateLeadStatus(id: string, status: string) {
  const response = await api.patch(`${API_ROUTES.CRM.LEADS}/${id}/status`, { status });
  return response.data;
}

export async function assignLead(id: string, assignedToId: string | null) {
  const response = await api.patch(`${API_ROUTES.CRM.LEADS}/${id}/assign`, { assignedToId });
  return response.data;
}

export async function getLeadTimeline(id: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.CRM.LEADS}/${id}/timeline`, { signal });
  return response.data;
}

export async function getLeadActivities(id: string, params?: { page?: number; limit?: number; completed?: boolean }, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.CRM.LEADS}/${id}/activities`, { params, signal });
  return response.data;
}

export async function createActivity(
  leadId: string,
  data: {
    type: string;
    title: string;
    description?: string;
    dueDate?: string;
    completed?: boolean;
  },
) {
  const response = await api.post(`${API_ROUTES.CRM.LEADS}/${leadId}/activities`, data);
  return response.data;
}

export async function toggleActivity(id: string) {
  const response = await api.patch(`${API_ROUTES.CRM.ACTIVITIES}/${id}/toggle`);
  return response.data;
}

export async function deleteActivity(id: string) {
  const response = await api.delete(`${API_ROUTES.CRM.ACTIVITIES}/${id}`);
  return response.data;
}

// ── Shared list meta ─────────────────────────────────────────────────────────

export interface CrmListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CrmUserRef {
  id: string;
  name: string;
  email?: string;
}

// ── Companies ────────────────────────────────────────────────────────────────

export interface CompanyListItem {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  ownerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: CrmUserRef | null;
  contactCount: number;
  dealCount: number;
}

export interface CompanyDetail extends Omit<CompanyListItem, 'contactCount' | 'dealCount'> {
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    status: string;
    owner: CrmUserRef | null;
  }>;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    probability: number;
    expectedCloseDate: string | null;
    wonAt: string | null;
    lostAt: string | null;
    stage: { id: string; name: string; isWon: boolean; isLost: boolean } | null;
    owner: CrmUserRef | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    dueDate: string | null;
    completed: boolean;
    assignedTo: { id: string; name: string } | null;
  }>;
  stats: {
    openDealCount: number;
    openPipelineValue: number;
    wonDealCount: number;
    wonValue: number;
  };
}

export interface CompanyListParams {
  page?: number;
  limit?: number;
  search?: string;
  ownerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CompanyPayload {
  name?: string;
  domain?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  ownerId?: string | null;
  notes?: string | null;
}

export async function getCompanies(params?: CompanyListParams, signal?: AbortSignal) {
  const response = await api.get<{ data: CompanyListItem[]; meta: CrmListMeta }>(
    API_ROUTES.CRM.COMPANIES,
    { params, signal },
  );
  return response.data;
}

export async function getCompanyById(id: string, signal?: AbortSignal) {
  const response = await api.get<CompanyDetail>(`${API_ROUTES.CRM.COMPANIES}/${id}`, { signal });
  return response.data;
}

export async function createCompany(data: CompanyPayload & { name: string }) {
  const response = await api.post<CompanyListItem>(API_ROUTES.CRM.COMPANIES, data);
  return response.data;
}

export async function updateCompany(id: string, data: CompanyPayload) {
  const response = await api.patch<CompanyListItem>(`${API_ROUTES.CRM.COMPANIES}/${id}`, data);
  return response.data;
}

export async function deleteCompany(id: string) {
  const response = await api.delete<{ message: string }>(`${API_ROUTES.CRM.COMPANIES}/${id}`);
  return response.data;
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface ContactListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  companyId: string | null;
  jobTitle: string | null;
  status: ContactStatus;
  source: string | null;
  ownerId: string | null;
  leadId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: CrmUserRef | null;
  companyRecord: { id: string; name: string } | null;
}

export interface ContactListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContactStatus;
  ownerId?: string;
  companyId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ContactPayload {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  companyId?: string | null;
  jobTitle?: string | null;
  status?: ContactStatus;
  source?: string | null;
  ownerId?: string | null;
  leadId?: string | null;
  notes?: string | null;
}

export async function getContacts(params?: ContactListParams, signal?: AbortSignal) {
  const response = await api.get<{ data: ContactListItem[]; meta: CrmListMeta }>(
    API_ROUTES.CRM.CONTACTS,
    { params, signal },
  );
  return response.data;
}

export async function getContactById(id: string, signal?: AbortSignal) {
  const response = await api.get<ContactListItem>(`${API_ROUTES.CRM.CONTACTS}/${id}`, { signal });
  return response.data;
}

export async function createContact(data: ContactPayload & { firstName: string; lastName: string }) {
  const response = await api.post<ContactListItem>(API_ROUTES.CRM.CONTACTS, data);
  return response.data;
}

export async function updateContact(id: string, data: ContactPayload) {
  const response = await api.patch<ContactListItem>(`${API_ROUTES.CRM.CONTACTS}/${id}`, data);
  return response.data;
}

export async function deleteContact(id: string) {
  const response = await api.delete<{ message: string }>(`${API_ROUTES.CRM.CONTACTS}/${id}`);
  return response.data;
}

// ── Deals ────────────────────────────────────────────────────────────────────

export interface DealStageRef {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface DealListItem {
  id: string;
  title: string;
  value: number;
  pipelineId: string | null;
  stageId: string | null;
  companyId: string | null;
  probability: number;
  expectedCloseDate: string | null;
  ownerId: string | null;
  notes: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
  stage: DealStageRef | null;
  companyRecord: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string; email: string | null; company: string | null } | null;
  lead: { id: string; leadNumber: string; name: string; status: string } | null;
  owner: CrmUserRef | null;
}

export interface DealListParams {
  page?: number;
  limit?: number;
  search?: string;
  stageId?: string;
  pipelineId?: string;
  ownerId?: string;
  companyId?: string;
  contactId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DealPayload {
  title?: string;
  value?: number;
  pipelineId?: string;
  stageId?: string;
  contactId?: string | null;
  companyId?: string | null;
  leadId?: string | null;
  ownerId?: string | null;
  expectedCloseDate?: string | null;
  probability?: number;
  notes?: string;
}

export interface MoveDealStagePayload {
  stageId: string;
  probability?: number;
  lostReason?: string;
}

export interface DealStageHistoryEntry {
  id: string;
  fromStageId: string | null;
  fromStageName: string | null;
  toStageId: string;
  toStageName: string;
  createdAt: string;
  changedBy: { id: string; name: string } | null;
}

export async function getDeals(params?: DealListParams, signal?: AbortSignal) {
  const response = await api.get<{ data: DealListItem[]; meta: CrmListMeta }>(
    API_ROUTES.CRM.DEALS,
    { params, signal },
  );
  return response.data;
}

export async function getDealById(id: string, signal?: AbortSignal) {
  const response = await api.get<DealListItem>(`${API_ROUTES.CRM.DEALS}/${id}`, { signal });
  return response.data;
}

export async function createDeal(data: DealPayload & { title: string }) {
  const response = await api.post<DealListItem>(API_ROUTES.CRM.DEALS, data);
  return response.data;
}

export async function updateDeal(id: string, data: DealPayload) {
  const response = await api.patch<DealListItem>(`${API_ROUTES.CRM.DEALS}/${id}`, data);
  return response.data;
}

export async function deleteDeal(id: string) {
  const response = await api.delete<{ message: string }>(`${API_ROUTES.CRM.DEALS}/${id}`);
  return response.data;
}

export async function moveDealStage(id: string, data: MoveDealStagePayload) {
  const response = await api.patch<DealListItem>(`${API_ROUTES.CRM.DEALS}/${id}/stage`, data);
  return response.data;
}

export async function getDealStageHistory(id: string, signal?: AbortSignal) {
  const response = await api.get<{ data: DealStageHistoryEntry[] }>(
    `${API_ROUTES.CRM.DEALS}/${id}/stage-history`,
    { signal },
  );
  return response.data;
}

// ── Pipelines & stages ──────────────────────────────────────────────────────

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getPipelines(params?: { page?: number; limit?: number }, signal?: AbortSignal) {
  const response = await api.get<{ data: Pipeline[]; meta: CrmListMeta }>(
    API_ROUTES.CRM.PIPELINES,
    { params, signal },
  );
  return response.data;
}

export async function getPipelineStages(pipelineId: string, signal?: AbortSignal) {
  const response = await api.get<PipelineStage[]>(
    `${API_ROUTES.CRM.PIPELINES}/${pipelineId}/stages`,
    { signal },
  );
  return response.data;
}

// ── Activities ──────────────────────────────────────────────────────────────

export interface CrmActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  lead: { id: string; leadNumber: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  deal: { id: string; title: string } | null;
  company: { id: string; name: string } | null;
}

export interface ActivityListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  completed?: boolean;
  overdue?: boolean;
  from?: string;
  to?: string;
  leadId?: string;
  contactId?: string;
  dealId?: string;
  companyId?: string;
  assignedToId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityPayload {
  type: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  completed?: boolean;
  leadId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  companyId?: string | null;
  assignedToId?: string | null;
}

export async function getActivities(params?: ActivityListParams, signal?: AbortSignal) {
  const response = await api.get<{ data: CrmActivity[]; meta: CrmListMeta }>(
    API_ROUTES.CRM.ACTIVITIES,
    { params, signal },
  );
  return response.data;
}

export async function getActivityById(id: string, signal?: AbortSignal) {
  const response = await api.get<CrmActivity>(`${API_ROUTES.CRM.ACTIVITIES}/${id}`, { signal });
  return response.data;
}

export async function createCrmActivity(data: ActivityPayload) {
  const response = await api.post<CrmActivity>(API_ROUTES.CRM.ACTIVITIES, data);
  return response.data;
}

export async function updateCrmActivity(id: string, data: Partial<ActivityPayload>) {
  const response = await api.patch<CrmActivity>(`${API_ROUTES.CRM.ACTIVITIES}/${id}`, data);
  return response.data;
}

// ── Dashboard & reports ─────────────────────────────────────────────────────

export interface CrmDashboardKpis {
  revenue: number;
  wonCount: number;
  lostCount: number;
  openDealCount: number;
  openPipelineValue: number;
  weightedPipeline: number;
  conversionRate: number;
  averageSalesCycleDays: number;
  medianSalesCycleDays: number;
  salesCycleSampleSize: number;
  targetAmount: number;
  targetAchievement: number | null;
  newLeadCount: number;
  newContactCount: number;
  newDealCount: number;
}

export interface CrmFunnelStage {
  stageId: string;
  name: string;
  position: number;
  dealCount: number;
  value: number;
  conversionFromPrevious: number;
}

export interface CrmRevenueTrend {
  labels: string[];
  revenue: number[];
  deals: number[];
}

export interface CrmDashboard {
  range: { startDate: string; endDate: string };
  kpis: CrmDashboardKpis;
  funnel: CrmFunnelStage[];
  revenueTrend: CrmRevenueTrend;
}

export interface CrmLeaderboardRow {
  ownerId: string;
  name: string;
  email: string;
  wonCount: number;
  wonRevenue: number;
  openCount: number;
  openValue: number;
}

export interface CrmTargetRow {
  id: string;
  ownerId: string | null;
  owner: CrmUserRef | null;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes: string | null;
  achieved: number;
  achievement: number;
}

export interface CrmReports extends CrmDashboard {
  granularity: 'day' | 'week' | 'month';
  leaderboard: CrmLeaderboardRow[];
  targets: CrmTargetRow[];
}

export interface CrmReportParams {
  startDate?: string;
  endDate?: string;
  ownerId?: string;
  granularity?: 'day' | 'week' | 'month';
  leaderboardLimit?: number;
}

export async function getCrmDashboard(params?: CrmReportParams, signal?: AbortSignal) {
  const response = await api.get<CrmDashboard>(API_ROUTES.CRM.DASHBOARD, { params, signal });
  return response.data;
}

export async function getCrmReports(params?: CrmReportParams, signal?: AbortSignal) {
  const response = await api.get<CrmReports>(API_ROUTES.CRM.REPORTS, { params, signal });
  return response.data;
}

// ── Sales targets ───────────────────────────────────────────────────────────

export interface SalesTarget {
  id: string;
  ownerId: string | null;
  owner: CrmUserRef | null;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  achieved: number;
  wonCount: number;
  achievement: number;
}

export interface SalesTargetPayload {
  periodStart: string;
  periodEnd: string;
  amount: number;
  ownerId?: string | null;
  notes?: string | null;
}

export async function getSalesTargets(
  params?: { from?: string; to?: string; ownerId?: string },
  signal?: AbortSignal,
) {
  const response = await api.get<{ data: SalesTarget[]; meta: CrmListMeta }>(
    API_ROUTES.CRM.SALES_TARGETS,
    { params, signal },
  );
  return response.data;
}

export async function createSalesTarget(data: SalesTargetPayload) {
  const response = await api.post<SalesTarget>(API_ROUTES.CRM.SALES_TARGETS, data);
  return response.data;
}

export async function updateSalesTarget(id: string, data: Partial<SalesTargetPayload>) {
  const response = await api.patch<SalesTarget>(`${API_ROUTES.CRM.SALES_TARGETS}/${id}`, data);
  return response.data;
}

export async function deleteSalesTarget(id: string) {
  const response = await api.delete<{ message: string }>(`${API_ROUTES.CRM.SALES_TARGETS}/${id}`);
  return response.data;
}
