import { SetMetadata } from '@nestjs/common';

export type PermissionMode = 'AND' | 'OR';

export interface PermissionRequirement {
  permissions: string[];
  mode: PermissionMode;
}

export const PERMISSIONS_KEY = 'permissions';

export function Permissions(permissions: string[], mode: PermissionMode = 'AND') {
  return SetMetadata(PERMISSIONS_KEY, { permissions, mode });
}
