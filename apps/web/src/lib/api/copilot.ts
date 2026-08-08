import { api } from './client';
import { API_ROUTES } from './routes';

export interface AiInsightTableRow {
  name: string;
  value: string;
  detail?: string;
}

export interface AiInsightTable {
  columns: string[];
  rows: AiInsightTableRow[];
}

export interface AiQueryData {
  intent: string;
  title: string;
  permitted: boolean;
  value?: number;
  currency: string;
  deniedReason?: string;
  points?: Array<{ label: string; value: number }>;
  tables?: AiInsightTable[];
  summaryLines?: string[];
}

export interface AiProviderStatus {
  configured: boolean;
  provider: string;
  model: string | null;
}

export interface AiUnavailable {
  code: string;
  message: string;
}

export interface AiAskResponse {
  intent: string;
  provider: AiProviderStatus;
  data?: AiQueryData;
  answer?: { text: string; model: string };
  unavailable?: AiUnavailable;
}

export async function getCopilotStatus(signal?: AbortSignal): Promise<AiProviderStatus> {
  const response = await api.get(API_ROUTES.AI.STATUS, { signal });
  return response.data;
}

export async function askCopilot(
  query: string,
  maxTokens?: number,
  signal?: AbortSignal,
): Promise<AiAskResponse> {
  const response = await api.post(
    API_ROUTES.AI.ASK,
    { query, maxTokens },
    { signal },
  );
  return response.data;
}