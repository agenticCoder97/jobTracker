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
    const score = computeMatchScore(job({ title: 'GraphQL API Engineer', tags: ['GraphQL'] }), [
      'graphql',
      'GRAPHQL',
      'graphql',
    ]);
    expect(score).toBe(100);
  });

  test('score is clamped to the 0..100 integer range', () => {
    const score = computeMatchScore(job({ title: 'Engineer' }), ['engineer']);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('weights resume-backed senior Java Spring backend roles over generic overlap', () => {
    const profile = {
      keywords: ['java', 'spring boot', 'microservices', 'kafka', 'aws', 'react'],
      requiredSkills: ['java', 'spring boot', 'sql'],
      preferredTitles: ['senior software engineer', 'backend engineer'],
      locations: ['santa clara', 'remote'],
      remote: 'hybrid' as const,
    };

    const strong = computeMatchScore(
      job({
        title: 'Senior Java Backend Engineer',
        location: 'San Jose, CA',
        remote: 'hybrid',
        description:
          'Own Spring Boot microservices, REST APIs, Kafka pipelines, SQL persistence, AWS deployments, and production incidents.',
        tags: ['Java', 'Spring Boot', 'Kafka', 'AWS'],
      }),
      profile.keywords,
      profile,
    );
    const weak = computeMatchScore(
      job({
        title: 'Frontend Software Engineer',
        location: 'San Francisco, CA',
        remote: 'onsite',
        description: 'Build React UI surfaces with CSS and design system components.',
        tags: ['React', 'CSS'],
      }),
      profile.keywords,
      profile,
    );

    expect(strong).toBeGreaterThanOrEqual(82);
    expect(weak).toBeLessThan(55);
    expect(strong - weak).toBeGreaterThanOrEqual(30);
  });

  test('recognizes common aliases for resume skills', () => {
    const score = computeMatchScore(
      job({
        title: 'Platform Engineer',
        description:
          'Build RESTful services with J2EE, PostgreSQL, MSK, CI/CD, containers, and role based access control.',
      }),
      ['rest microservices', 'java', 'kafka', 'postgresql', 'docker', 'kubernetes', 'rbac'],
    );
    expect(score).toBeGreaterThanOrEqual(65);
  });
});
