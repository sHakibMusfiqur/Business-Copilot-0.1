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
  onboardingToken?: string;
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
const ONBOARDING_TOKEN_PREFIX = 'bc_onboarding_token';


const onboardingTokenFallback = new Map<string, string>();

function tokenKey(sessionId: string): string {
  return `${ONBOARDING_TOKEN_PREFIX}_${sessionId}`;
}

export function getOnboardingToken(sessionId: string): string | null {
  const key = tokenKey(sessionId);
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        onboardingTokenFallback.set(sessionId, stored);
        return stored;
      }
    } catch {
      // localStorage unavailable/blocked; fall through to the in-memory fallback.
    }
  }
  return onboardingTokenFallback.get(sessionId) ?? null;
}

export function storeOnboardingToken(sessionId: string, token: string | undefined | null): void {
  if (!token) return;
  onboardingTokenFallback.set(sessionId, token);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(tokenKey(sessionId), token);
    } catch {
      // localStorage unavailable/blocked; the in-memory fallback already holds it.
    }
  }
}

export function sessionHeaders(sessionId: string): Record<string, string> {
  const token = getOnboardingToken(sessionId);
  return token ? { 'X-Onboarding-Token': token } : {};
}

export async function getIndustries(signal?: AbortSignal): Promise<OnboardingIndustry[]> {
  const response = await api.get(API_ROUTES.ONBOARDING.INDUSTRIES, { signal });
  return response.data;
}

export async function createSession(email: string, name: string): Promise<OnboardingSession> {
  const response = await api.post(API_ROUTES.ONBOARDING.SESSIONS, { email, name });
  const session = response.data as OnboardingSession;
  storeOnboardingToken(session.id, session.onboardingToken);
  return session;
}

export async function getSession(id: string, signal?: AbortSignal): Promise<OnboardingSession> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}`, {
    headers: sessionHeaders(id),
    signal,
  });
  return response.data;
}

export async function getSessionByEmail(email: string, signal?: AbortSignal): Promise<OnboardingSession> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.BY_EMAIL}/${encodeURIComponent(email)}`, { signal });
  const session = response.data as OnboardingSession;
  storeOnboardingToken(session.id, session.onboardingToken);
  return session;
}

export async function updateSession(
  id: string,
  data: Record<string, unknown>,
): Promise<OnboardingSession> {
  const response = await api.patch(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}`, data, {
    headers: sessionHeaders(id),
  });
  return response.data;
}

export async function completeStep(id: string, step: number): Promise<OnboardingSession> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/complete-step`, { step }, {
    headers: sessionHeaders(id),
  });
  return response.data;
}

export async function getProvisioningPreview(id: string, signal?: AbortSignal): Promise<unknown> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/preview`, {
    headers: sessionHeaders(id),
    signal,
  });
  return response.data;
}

export async function getProvisioningProgress(id: string, signal?: AbortSignal): Promise<ProvisioningProgress> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/progress`, {
    headers: sessionHeaders(id),
    signal,
  });
  return response.data;
}

export async function provisionOrganization(
  id: string,
  data?: { selectedIndustry?: string | null; orgName?: string | null },
): Promise<OnboardingSession> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/provision`, data ?? {}, {
    headers: sessionHeaders(id),
  });
  return response.data;
}

export async function getProvisioningSseToken(id: string): Promise<{ token: string; expiresInSeconds: number }> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${id}/sse-token`, {
    headers: sessionHeaders(id),
  });
  return response.data;
}

export function createProvisioningEventSource(id: string, sseToken: string): EventSource {

  const query = sseToken ? `?sseToken=${encodeURIComponent(sseToken)}` : '';
  return new EventSource(`${SSE_BASE_URL}/api/onboarding/sessions/${id}/progress/stream${query}`);
}

export async function getChecklist(sessionId: string, signal?: AbortSignal): Promise<ChecklistItem[]> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist`, {
    headers: sessionHeaders(sessionId),
    signal,
  });
  return response.data;
}

export async function markChecklistComplete(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/${itemId}/complete`, undefined, {
    headers: sessionHeaders(sessionId),
  });
  return response.data;
}

export async function markChecklistIncomplete(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/${itemId}/incomplete`, undefined, {
    headers: sessionHeaders(sessionId),
  });
  return response.data;
}

export async function skipChecklistItem(sessionId: string, itemId: string): Promise<ChecklistItem> {
  const response = await api.post(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/${itemId}/skip`, undefined, {
    headers: sessionHeaders(sessionId),
  });
  return response.data;
}

export async function getChecklistProgress(sessionId: string, signal?: AbortSignal): Promise<ChecklistProgress> {
  const response = await api.get(`${API_ROUTES.ONBOARDING.SESSIONS}/${sessionId}/checklist/progress`, {
    headers: sessionHeaders(sessionId),
    signal,
  });
  return response.data;
}
