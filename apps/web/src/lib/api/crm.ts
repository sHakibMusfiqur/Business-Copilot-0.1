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
