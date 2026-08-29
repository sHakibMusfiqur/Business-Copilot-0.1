export const NON_DELEGABLE_PERMISSIONS: ReadonlySet<string> = new Set(['organization.manage']);


export function isPermissionGrantable(permissionName: string, actorPermissions: string[]): boolean {
  if (NON_DELEGABLE_PERMISSIONS.has(permissionName)) return false;
  return actorPermissions.includes(permissionName);
}