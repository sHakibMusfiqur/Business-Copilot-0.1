import type { ProvisionStatus } from '@bc/types';

import { api } from './client';
import { API_ROUTES } from './routes';

export interface OnboardingIndustry {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  categories: { id: string; name: string; description: string }[];
  defaultModules: string[];
  estimatedUsers: number;
  estimatedMonthlyPrice: number;
}

export interface OnboardingSession {
  id: string;
  email: string;
  name: string;
  userId: string | null;
  version: number;
  currentStep: number;
  completedSteps: number[];
  selectedIndustry: string | null;
  selectedCategory: string | null;
  selectedCategories: string[];
  orgName: string | null;
  orgEmail: string | null;
  orgPhone: string | null;
  orgWebsite: string | null;
  orgCountry: string | null;
  orgState: string | null;
  orgCity: string | null;
  orgAddress: string | null;
  orgTimezone: string | null;
  orgCurrency: string | null;
  orgLanguage: string | null;
  businessProfile: Record<string, unknown> | null;
  selectedModules: string[];
  aiEnabled: boolean;
  aiLanguage: string | null;
  aiPersonality: string | null;
  selectedPlanId: string | null;
  planInterval: string | null;
  provisionStatus: ProvisionStatus;
  provisionData: Record<string, unknown> | null;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisioningProgress {
  sessionId: string;
  status: ProvisionStatus;
  progress: number;
  currentTask: string | null;
  completedTasks: string[];
  failedTask: string | null;
  error: string | null;
}

export interface ChecklistItem {
  id: string;
  itemId: string;
  label: string;
  icon: string | null;
  href: string | null;
  completed: boolean;
  skippable: boolean;
  sortOrder: number;
  completedAt: string | null;
}

export interface ChecklistProgress {
  total: number;
  completed: number;
  percentage: number;
}

const SSE_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function getIndustries(signal?: AbortSignal): Promise<OnboardingIndustry[]> {
  const response = await api.get(API_ROUTES.ONBOARDING.INDUSTRIES, { signal });
  return response.data;
}

export async function createSession(email: string, name: string): Promise<OnboardingSession> {
  const response = await api.post(API_ROUTES.ONBOARDING.SESSIONS, { email, name });
  return response.data;
}

export async function getSession(id: string, signal?: AbortSignal): Promise<OnboardingSession> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}`, { signal });
  return response.data;
}

export async function getSessionByEmail(email: string, signal?: AbortSignal): Promise<OnboardingSession> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.BY_EMAIL}/${encodeURIComponent(email)}`, { signal });
  return response.data;
}

export async function updateSession(
  id: string,
  data: Record<string, unknown>,
): Promise<OnboardingSession> {
  const response = await api.patch(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}`, data);
  return response.data;
}

export async function completeStep(id: string, step: number): Promise<OnboardingSession> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/complete-step`, { step });
  return response.data;
}

export async function getProvisioningPreview(id: string, signal?: AbortSignal): Promise<unknown> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/preview`, { signal });
  return response.data;
}

export async function getProvisioningProgress(id: string, signal?: AbortSignal): Promise<ProvisioningProgress> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/progress`, { signal });
  return response.data;
}

export async function provisionOrganization(
  id: string,
  data?: { selectedIndustry?: string | null; orgName?: string | null },
): Promise<OnboardingSession> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/provision`, data ?? {});
  return response.data;
}

export function createProvisioningEventSource(id: string): EventSource {
  return new EventSource(`${SSE_BASE_URL}/api/onboarding/sessions/${id}/progress/stream`);
}

export async function getChecklist(sessionId: string, signal?: AbortSignal): Promise<ChecklistItem[]> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist`, { signal });
  return response.data;
}

export async function markChecklistComplete(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/${itemId}/complete`);
  return response.data;
}

export async function markChecklistIncomplete(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/${itemId}/incomplete`);
  return response.data;
}

export async function skipChecklistItem(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/${itemId}/skip`);
  return response.data;
}

export async function getChecklistProgress(sessionId: string, signal?: AbortSignal): Promise<ChecklistProgress> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/progress`, { signal });
  return response.data;
}
