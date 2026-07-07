import { redactMetadata } from '@/lib/repositories/types';
import type { UserActionRepository, UserActionRow } from '@/lib/repositories/types';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalUserActionRepository(): UserActionRepository {
  const rows: UserActionRow[] = [];
  return {
    async append(input) {
      const row: UserActionRow = {
        ...input,
        ...(input.metadata !== undefined ? { metadata: redactMetadata(input.metadata) } : {}),
        id: uuid(),
        occurredAt: new Date().toISOString(),
      };
      rows.push(row);
      return row;
    },
    async list(filter) {
      const limit = filter?.limit ?? 200;
      const filtered = filter?.ownerUserId
        ? rows.filter((r) => r.ownerUserId === filter.ownerUserId)
        : rows;
      return filtered.slice(-limit).reverse();
    },
  };
}
