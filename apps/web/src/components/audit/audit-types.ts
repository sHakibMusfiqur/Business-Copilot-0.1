import type { Meta } from '@/lib/types';

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

export type AuditMeta = Meta;

export interface AuditListResponse {
  data: AuditLog[];
  meta: AuditMeta;
}
