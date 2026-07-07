import type { ExternalJob } from '@/lib/api/types';

/**
 * Deterministic 0–100 keyword-overlap score. When there are no keywords we
 * return a neutral 50 so an unconfigured user still sees a sensible ranking.
 * Otherwise: (distinct keywords found in the job's searchable text) /
 * (distinct keywords) × 100, rounded to an integer.
 */
export function computeMatchScore(job: ExternalJob, keywords: string[]): number {
  const distinct = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0)),
  );
  if (distinct.length === 0) return 50;

  const haystack = [job.title, job.description ?? '', ...(job.tags ?? [])]
    .join(' ')
    .toLowerCase();

  const hits = distinct.filter((k) => haystack.includes(k)).length;
  const score = Math.round((hits / distinct.length) * 100);
  return Math.max(0, Math.min(100, score));
}
