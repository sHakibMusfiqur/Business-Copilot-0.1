import { api } from './client';
import { API_ROUTES } from './routes';

export interface LeaveEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  department?: { id: string; name: string };
}

export interface Leave {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
  employee: LeaveEmployee;
}

export type LeavesResponse = Leave[];

export interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface GetLeavesParams {
  employeeId?: string;
  status?: string;
  type?: string;
}

export async function getLeaves(params?: GetLeavesParams): Promise<LeavesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.employeeId) searchParams.set('employeeId', params.employeeId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);

  const query = searchParams.toString();
  const url = query ? `${API_ROUTES.LEAVES.ROOT}?${query}` : API_ROUTES.LEAVES.ROOT;

  const response = await api.get<LeavesResponse>(url);
  return response.data;
}

export async function getLeave(id: string): Promise<Leave> {
  const response = await api.get<Leave>(`${API_ROUTES.LEAVES.ROOT}/${id}`);
  return response.data;
}

export async function getLeaveStats(): Promise<LeaveStats> {
  const response = await api.get<LeaveStats>(API_ROUTES.LEAVES.STATS);
  return response.data;
}

export interface CreateLeaveData {
  employeeId: string;
  startDate: string;
  endDate: string;
  type?: string;
  reason?: string;
}

export async function createLeave(data: CreateLeaveData): Promise<Leave> {
  const response = await api.post<Leave>(API_ROUTES.LEAVES.ROOT, data);
  return response.data;
}

export interface UpdateLeaveData {
  startDate?: string;
  endDate?: string;
  type?: string;
  reason?: string;
}

export async function updateLeave(id: string, data: UpdateLeaveData): Promise<Leave> {
  const response = await api.patch<Leave>(`${API_ROUTES.LEAVES.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteLeave(id: string): Promise<void> {
  await api.delete(`${API_ROUTES.LEAVES.ROOT}/${id}`);
}

export async function approveLeave(id: string): Promise<Leave> {
  const response = await api.post<Leave>(`${API_ROUTES.LEAVES.ROOT}/${id}/approve`);
  return response.data;
}

export async function rejectLeave(id: string): Promise<Leave> {
  const response = await api.post<Leave>(`${API_ROUTES.LEAVES.ROOT}/${id}/reject`);
  return response.data;
}
