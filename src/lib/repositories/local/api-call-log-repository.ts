import type { ApiCallLogRepository, ApiCallLogRow } from '@/lib/repositories/types';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalApiCallLogRepository(): ApiCallLogRepository {
  const rows: ApiCallLogRow[] = [];
  return {
    async append(input) {
      const row: ApiCallLogRow = {
        ...input,
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    },
    async list(filter) {
      const limit = filter?.limit ?? 200;
      const filtered = filter?.providerId
        ? rows.filter((r) => r.providerId === filter.providerId)
        : rows;
      return filtered.slice(-limit).reverse();
    },
  };
}
