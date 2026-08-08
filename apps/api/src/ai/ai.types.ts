export type AiIntentKind =
  | 'sales_summary'
  | 'revenue'
  | 'expenses'
  | 'receivables'
  | 'payables'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'trends'
  | 'performance'
  | 'general';

export type AiUnavailableCode =
  | 'provider_not_configured'
  | 'provider_error'
  | 'tool_not_permitted';

export interface AiInsightTableRow {
  name: string;
  value: string;
  detail?: string;
}

export interface AiInsightTable {
  columns: string[];
  rows: AiInsightTableRow[];
}

/**
 * The grounded, permission-aware result of retrieving business data for the
 * Copilot. This is produced independently of any LLM provider so the frontend
 * can always render a truthful, data-backed snapshot.
 */
export interface AiQueryData {
  intent: AiIntentKind;
  title: string;
  /** Whether the requesting user may view the underlying data. */
  permitted: boolean;
  /** Numeric headline value (e.g. total revenue) when applicable. */
  value?: number;
  currency: string;
  /** Short, human-readable phrase shown when `permitted` is false. */
  deniedReason?: string;
  points?: AiInsightPoint[];
  tables?: AiInsightTable[];
  summaryLines?: string[];
}

export interface AiInsightPoint {
  label: string;
  value: number;
}

export interface AiAnswer {
  text: string;
  model: string;
}

export interface AiProviderStatus {
  configured: boolean;
  provider: string;
  model: string | null;
}

export interface AiUnavailable {
  code: AiUnavailableCode;
  message: string;
}

export interface AiAskResponse {
  intent: AiIntentKind;
  provider: AiProviderStatus;
  data?: AiQueryData;
  answer?: AiAnswer;
  unavailable?: AiUnavailable;
}