import 'server-only';

import { DEMO_USER_ID } from '@/lib/types';

/**
 * Single-user mode: every server-side read/write is pinned to this owner.
 * When auth lands, this becomes a session lookup; callers don't change.
 */
export function getOwnerUserId(): string {
  return DEMO_USER_ID;
}
