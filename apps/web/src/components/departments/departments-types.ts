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
