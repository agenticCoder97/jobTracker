import {
  type AppLog,
  type AuditEvent,
  type EventLogRepository,
  redactMetadata,
} from '@/lib/repositories/types';

const isDev = process.env.NODE_ENV !== 'production';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalEventLogRepository(): EventLogRepository {
  const audit: AuditEvent[] = [];
  const logs: AppLog[] = [];

  return {
    appendAudit(input) {
      const event: AuditEvent = {
        ...input,
        ...(input.metadata !== undefined ? { metadata: redactMetadata(input.metadata) } : {}),
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      audit.push(event);
      return event;
    },
    listAudit(filter) {
      if (!filter) return [...audit];
      return audit.filter((row) => {
        if (filter.entityId && row.entityId !== filter.entityId) return false;
        if (filter.entityType && row.entityType !== filter.entityType) return false;
        return true;
      });
    },
    appendLog(input) {
      const log: AppLog = {
        ...input,
        ...(input.context !== undefined ? { context: redactMetadata(input.context) } : {}),
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      logs.push(log);
      if (isDev && (log.level === 'warn' || log.level === 'error')) {
        const sink = log.level === 'error' ? console.error : console.warn;
        sink(`[applog:${log.level}] ${log.message}`, log.context ?? {});
      }
      return log;
    },
    listLogs() {
      return [...logs];
    },
    reset() {
      audit.length = 0;
      logs.length = 0;
    },
  };
}
