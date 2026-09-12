import type { Meta } from '@/lib/types';

export type EmployeeStatus = 'active' | 'inactive';

export interface EmployeeDepartment {
  id: string;
  name: string;
  code: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: string | null;
  hireDate: string;
  departmentId?: string | null;
  position?: string | null;
  isActive: boolean;
  createdAt: string;
  userId?: string | null;
  department?: EmployeeDepartment | null;
}

export interface EmployeeDetail extends Employee {
  phone?: string | null;
  salary?: number;
  updatedAt: string;
}

export type EmployeeMeta = Meta;

export interface EmployeeListResponse {
  data: Employee[];
  meta: EmployeeMeta;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: Array<{
    departmentId: string | null;
    count: number;
  }>;
}
