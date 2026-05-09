/**
 * Server-side RBAC guards. The DB enforces RLS regardless, but these helpers
 * give server actions/route handlers an early-rejection path with clear
 * error messages.
 *
 * Implementation deferred — once auth lands, these read `user_roles` for
 * `auth.uid()` via the cookie-aware server client.
 */

import 'server-only';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { PermissionId, RoleId } from '@/lib/rbac/types';

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly required: RoleId | PermissionId,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function getCurrentUserRoles(): Promise<RoleId[]> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await client
    .from('user_roles')
    .select('role_id')
    .eq('user_id', auth.user.id);
  if (error) {
    console.error('[rbac] failed to load user_roles', error);
    return [];
  }
  return (data ?? []).map((r) => r.role_id as RoleId);
}

export async function userHasRole(role: RoleId): Promise<boolean> {
  const roles = await getCurrentUserRoles();
  return roles.includes(role);
}

export async function assertRole(role: RoleId): Promise<void> {
  if (!(await userHasRole(role))) {
    throw new AuthorizationError(`requires role: ${role}`, role);
  }
}

/**
 * Permission-level check. Today this is implemented as a thin wrapper over
 * role membership; once we have a denormalised view of role_permissions in
 * the DB, swap this to a direct lookup.
 */
export async function assertPermission(permission: PermissionId): Promise<void> {
  // TODO(phase 2): query role_permissions ⨝ user_roles for current user.
  const roles = await getCurrentUserRoles();
  const granted = ROLE_PERMISSION_FALLBACK[permission] ?? [];
  if (!roles.some((r) => granted.includes(r))) {
    throw new AuthorizationError(`requires permission: ${permission}`, permission);
  }
}

const ROLE_PERMISSION_FALLBACK: Record<PermissionId, RoleId[]> = {
  'research:read': ['user', 'admin'],
  'research:write': ['user', 'admin'],
  'admin:read_all': ['admin'],
  'admin:manage_providers': ['admin'],
};
