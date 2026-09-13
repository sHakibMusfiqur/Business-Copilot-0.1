import type { Meta } from '@/lib/types';

export interface Department {
  id: string;
  name: string;
  code: string;
  organizationId: string | null;
  managerId: string | null;
  isActive: boolean;
  shared: boolean;
}

export interface CreateDepartmentData {
  name: string;
  code: string;
  managerId?: string | null;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  managerId?: string | null;
  isActive?: boolean;
}

export type DepartmentListMeta = Meta;

export interface DepartmentListResponse {
  data: Department[];
  meta: DepartmentListMeta;
}

export interface DepartmentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'code' | 'isActive' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
