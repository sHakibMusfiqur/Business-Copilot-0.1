export interface Permission {
  id: string;
  name: string;
  module: string;
  label: string;
  description: string | null;
  createdAt: string;
  rolePermissions?: Array<{ roleId: string }>;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  permissionCount: number;
}

export interface RoleDetails {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  permissions: Permission[];
}

export interface OrganizationUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  roleAssignments: Array<{
    role: { id: string; name: string };
  }>;
}

export interface GroupedPermissions {
  [module: string]: Permission[];
}
