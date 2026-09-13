export interface Department {
  id: string;
  name: string;
  code: string;
  organizationId: string | null;
  managerId: string | null;
  shared: boolean;
}

export interface CreateDepartmentData {
  name: string;
  code: string;
  managerId?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  managerId?: string;
  isActive?: boolean;
}
