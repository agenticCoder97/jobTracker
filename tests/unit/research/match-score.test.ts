import { describe, expect, test } from 'vitest';
import { computeMatchScore } from '@/lib/research/match-score';
import type { ExternalJob } from '@/lib/api/types';

function job(partial: Partial<ExternalJob>): ExternalJob {
  return {
    sourceProvider: 'themuse',
    sourceId: '1',
    title: 'Software Engineer',
    companyName: 'Acme',
    raw: null,
    ...partial,
  };
}

describe('computeMatchScore', () => {
  test('no keywords → neutral 50', () => {
    expect(computeMatchScore(job({}), [])).toBe(50);
  });

  test('full overlap of title + tags → 100', () => {
    const score = computeMatchScore(
      job({ title: 'Senior React Engineer', tags: ['react', 'typescript'] }),
      ['react', 'typescript', 'engineer'],
    );
    expect(score).toBe(100);
  });

  test('partial overlap scales between 0 and 100', () => {
    const score = computeMatchScore(
      job({ title: 'Data Scientist', description: 'python and sql', tags: [] }),
      ['python', 'react', 'go', 'rust'],
    );
    // 1 of 4 keywords present → 25
    expect(score).toBe(25);
  });

  test('is case-insensitive and ignores duplicate keywords', () => {
    const score = computeMatchScore(
      job({ title: 'GraphQL API Engineer', tags: ['GraphQL'] }),
      ['graphql', 'GRAPHQL', 'graphql'],
    );
    expect(score).toBe(100);
  });

  test('score is clamped to the 0..100 integer range', () => {
    const score = computeMatchScore(job({ title: 'Engineer' }), ['engineer']);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
