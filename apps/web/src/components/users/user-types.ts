import type { Meta } from '@/lib/types';

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

export type UserMeta = Meta;

export interface UsersResponse {
  data: User[];
  meta: UserMeta;
}
