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

/** A user assigned to a role, as returned by GET /roles/:id/users. */
export interface RoleUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  isActive: boolean;
  roleAssignments: Array<{
    role: { id: string; name: string; isSystem: boolean };
  }>;
}

/** A single effective permission with its source role(s). */
export interface EffectivePermission {
  id: string;
  name: string;
  module: string;
  label: string;
  sourceRoles: Array<{ id: string; name: string }>;
}

/** Response shape for GET /users/:id/effective-permissions. */
export interface EffectivePermissionsResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  roles: Array<{ id: string; name: string; isSystem: boolean }>;
  permissions: EffectivePermission[];
}
