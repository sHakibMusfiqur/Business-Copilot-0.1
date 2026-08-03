import { api } from './client';
import { API_ROUTES } from './routes';

export interface CreateInvitationInput {
  name: string;
  email: string;
  departmentId?: string;
  designation?: string;
  managerId?: string;
  roleIds?: string[];
}

export interface Invitation {
  id: string;
  email: string;
  name: string;
  department: { id: string; name: string } | null;
  designation: string | null;
  manager: { id: string; name: string } | null;
  roleIds: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expired: boolean;
  expiresAt: string;
  createdAt: string;
  resendCount: number;
}

export interface CreateInvitationResult {
  id: string;
  email: string;
  name: string;
  status: string;
  expiresAt: string;
  emailSent: boolean;
  inviteUrl?: string;
  message: string;
}

export interface VerifiedInvitation {
  valid: true;
  email: string;
  name: string;
  expiresAt: string;
  organization: { name: string };
  brand: {
    companyName: string;
    tagline: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
  name?: string;
}

export async function createInvitation(data: CreateInvitationInput) {
  const response = await api.post<CreateInvitationResult>(API_ROUTES.INVITATIONS.ROOT, data);
  return response.data;
}

export async function getInvitations(signal?: AbortSignal) {
  const response = await api.get<Invitation[]>(API_ROUTES.INVITATIONS.ROOT, { signal });
  return response.data;
}

export async function resendInvitation(id: string) {
  const response = await api.post<{ id: string; emailSent: boolean; inviteUrl?: string }>(
    `${API_ROUTES.INVITATIONS.ROOT}/${id}/resend`,
  );
  return response.data;
}

export async function revokeInvitation(id: string) {
  const response = await api.delete<{ id: string; status: string }>(
    `${API_ROUTES.INVITATIONS.ROOT}/${id}`,
  );
  return response.data;
}

export async function verifyInvitation(token: string, signal?: AbortSignal) {
  const response = await api.get<VerifiedInvitation>(API_ROUTES.INVITATIONS.VERIFY, {
    params: { token },
    signal,
  });
  return response.data;
}

export async function acceptInvitation(data: AcceptInvitationInput) {
  const response = await api.post<{ success: boolean; message: string }>(
    API_ROUTES.INVITATIONS.ACCEPT,
    data,
  );
  return response.data;
}
