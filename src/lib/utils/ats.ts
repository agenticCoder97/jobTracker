import type { AtsResult } from '@/lib/types';

export function computeAts(input: {
  resumeKeywords: string[];
  required: string[];
  nice: string[];
  edits?: string[];
  rewrites?: { from: string; to: string }[];
}): AtsResult {
  const present = new Set(input.resumeKeywords.map((keyword) => keyword.toLowerCase()));
  const reqHit = input.required.filter((keyword) => present.has(keyword.toLowerCase())).length;
  const niceHit = input.nice.filter((keyword) => present.has(keyword.toLowerCase())).length;
  const score = Math.round(
    (reqHit / Math.max(1, input.required.length)) * 80 +
      (niceHit / Math.max(1, input.nice.length)) * 20,
  );

  return {
    required: input.required,
    nice: input.nice,
    reqHit,
    niceHit,
    score,
    edits: input.edits ?? [],
    missingHard: input.required.filter((keyword) => !present.has(keyword.toLowerCase())),
    missingSoft: input.nice.filter((keyword) => !present.has(keyword.toLowerCase())),
    rewrites: input.rewrites ?? [],
  };
}

export function gradeFor(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Excellent', color: 'var(--success)' };
  if (score >= 70) return { label: 'Strong', color: 'var(--gold)' };
  if (score >= 50) return { label: 'Moderate', color: 'var(--warning)' };
  return { label: 'Weak', color: 'var(--error)' };
}
