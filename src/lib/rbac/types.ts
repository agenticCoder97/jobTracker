/**
 * RBAC contracts. The DB is the source of truth (see migration 0002), but
 * these constants/types let TypeScript callers stay symbolic instead of
 * stringly-typed.
 */

export const ROLE_IDS = ['admin', 'user', 'system'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const PERMISSION_IDS = [
  'research:read',
  'research:write',
  'admin:read_all',
  'admin:manage_providers',
] as const;
export type PermissionId = (typeof PERMISSION_IDS)[number];

export type RoleAssignment = {
  userId: string;
  roleId: RoleId;
  grantedAt: string;
};

export type Role = {
  id: RoleId;
  label: string;
  description?: string | undefined;
};
