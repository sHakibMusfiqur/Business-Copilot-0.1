export interface AuditLog {
  id: string;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditListResponse {
  data: AuditLog[];
  meta: AuditMeta;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entity?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
