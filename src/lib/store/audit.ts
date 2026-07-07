import { eventLog } from '@/lib/repositories';
import type { AuditEvent } from '@/lib/repositories/types';
import { DEMO_USER_ID } from '@/lib/types';

/**
 * Thin wrapper used by Zustand store actions to record audit trail entries.
 * Keeping this in one place lets the future Supabase adapter swap the sink
 * without touching every call site.
 */
export function recordAudit(
  entityType: AuditEvent['entityType'],
  entityId: string,
  event: string,
  metadata?: Record<string, unknown>,
): void {
  try {
    eventLog.appendAudit({
      ownerUserId: DEMO_USER_ID,
      entityType,
      entityId,
      event,
      ...(metadata !== undefined ? { metadata } : {}),
    });
  } catch {
    // Audit must never break the user-facing action
  }
}
