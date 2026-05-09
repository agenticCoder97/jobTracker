import type { Application, Priority } from '@/lib/types';
import type { SortMode } from '@/lib/data/seed';

const priorityRank: Record<Priority, number> = { high: 0, med: 1, low: 2 };

export function resolveOrder(items: Application[], mode: SortMode): Application[] {
  const copy = [...items];
  if (mode === 'manual') {
    return copy.sort((a, b) => a.sortIndex - b.sortIndex || b.updatedAt.localeCompare(a.updatedAt));
  }
  if (mode === 'priority') {
    return copy.sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        b.lastActivity.localeCompare(a.lastActivity),
    );
  }
  if (mode === 'dateApplied') {
    return copy.sort((a, b) => (b.applied ?? b.posted).localeCompare(a.applied ?? a.posted));
  }
  return copy.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}
