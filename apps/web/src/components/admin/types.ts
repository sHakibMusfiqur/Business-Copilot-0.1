export type KpiMetric = {
  key: string;
  label: string;
  value: number | string;
  isCurrency?: boolean;
  icon?: React.ElementType;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet';
  trend?: { value: number };
  hint?: string;
  suffix?: string;
};

export type ChartData = {
  label?: string;
  value: number;
  color?: string;
};

export type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  icon?: React.ElementType;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
};

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export interface AdminListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet';
