import { api } from './api';

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
  provisionStatus: string;
  provisionData: Record<string, unknown> | null;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisioningProgress {
  sessionId: string;
  status: 'PENDING' | 'PROVISIONING' | 'COMPLETED' | 'FAILED';
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

export async function getIndustries(): Promise<OnboardingIndustry[]> {
  const response = await api.get('/onboarding/industries');
  return response.data;
}

export async function createSession(email: string, name: string): Promise<OnboardingSession> {
  const response = await api.post('/onboarding/sessions', { email, name });
  return response.data;
}

export async function getSession(id: string): Promise<OnboardingSession> {
  const response = await api.get(`/onboarding/sessions/${id}`);
  return response.data;
}

export async function getSessionByEmail(email: string): Promise<OnboardingSession> {
  const response = await api.get(`/onboarding/by-email/${encodeURIComponent(email)}`);
  return response.data;
}

export async function updateSession(
  id: string,
  data: Record<string, unknown>,
): Promise<OnboardingSession> {
  const response = await api.patch(`/onboarding/sessions/${id}`, data);
  return response.data;
}

export async function completeStep(id: string, step: number): Promise<OnboardingSession> {
  const response = await api.post(`/onboarding/sessions/${id}/complete-step`, { step });
  return response.data;
}

export async function getProvisioningPreview(id: string): Promise<unknown> {
  const response = await api.get(`/onboarding/sessions/${id}/preview`);
  return response.data;
}

export async function getProvisioningProgress(id: string): Promise<ProvisioningProgress> {
  const response = await api.get(`/onboarding/sessions/${id}/progress`);
  return response.data;
}

export async function provisionOrganization(
  id: string,
  data?: { selectedIndustry?: string | null; orgName?: string | null },
): Promise<OnboardingSession> {
  const response = await api.post(`/onboarding/sessions/${id}/provision`, data ?? {});
  return response.data;
}

export function createProvisioningEventSource(id: string): EventSource {
  return new EventSource(`${SSE_BASE_URL}/api/onboarding/sessions/${id}/progress/stream`);
}

export async function getChecklist(sessionId: string): Promise<ChecklistItem[]> {
  const response = await api.get(`/onboarding/sessions/${sessionId}/checklist`);
  return response.data;
}

export async function markChecklistComplete(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`/onboarding/sessions/${sessionId}/checklist/${itemId}/complete`);
  return response.data;
}

export async function markChecklistIncomplete(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`/onboarding/sessions/${sessionId}/checklist/${itemId}/incomplete`);
  return response.data;
}

export async function skipChecklistItem(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`/onboarding/sessions/${sessionId}/checklist/${itemId}/skip`);
  return response.data;
}

export async function getChecklistProgress(sessionId: string): Promise<ChecklistProgress> {
  const response = await api.get(`/onboarding/sessions/${sessionId}/checklist/progress`);
  return response.data;
}
