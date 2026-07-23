export interface UserRoleAssignment {
  role: {
    id: string;
    name: string;
    isSystem?: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roleAssignments: UserRoleAssignment[];
}

export interface UserMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UsersResponse {
  data: User[];
  meta: UserMeta;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  isActive?: boolean;
  role?: string;
  roleIds?: string[];
}

export interface UpdateUserPayload {
  name?: string;
  isActive?: boolean;
  role?: string;
  roleIds?: string[];
}
