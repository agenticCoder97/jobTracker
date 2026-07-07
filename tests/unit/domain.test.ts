import { describe, expect, test } from 'vitest';
import { APPLICATIONS, COMPANIES, seedAll } from '@/lib/data/seed';
import { resolveIcon } from '@/lib/icon-map';
import { computeAts, gradeFor } from '@/lib/utils/ats';
import { daysAgo, daysFrom, fmtDate } from '@/lib/utils/dates';
import { resolveOrder } from '@/lib/utils/sort-resolver';

describe('seed data', () => {
  test('contains the expected Plan 1 board data', () => {
    const seed = seedAll();
    expect(seed.applications).toHaveLength(14);
    expect(seed.notifications).toHaveLength(5);
    expect(COMPANIES.stripe?.name).toBe('Stripe');
    expect(seed.applications.find((app) => app.displayId === 'JT-39')?.status).toBe('applied');
  });
});

describe('helpers', () => {
  test('formats dates relative to the fixed seed anchor', () => {
    expect(daysAgo(7)).toBe('2026-05-01');
    expect(daysFrom('2026-05-01')).toBe(7);
    expect(fmtDate('2026-05-08')).toBe('May 8, 2026');
  });

  test('resolves icons and ATS grades', () => {
    expect(resolveIcon('layout-dashboard')).toBe('space_dashboard');
    expect(resolveIcon('playlist-add')).toBe('playlist_add');
    expect(resolveIcon('rocket_launch')).toBe('rocket_launch');
    expect(gradeFor(85).label).toBe('Excellent');
    expect(gradeFor(70).label).toBe('Strong');
    expect(gradeFor(50).label).toBe('Moderate');
    expect(gradeFor(49).label).toBe('Weak');
  });

  test('computes ATS score and board order', () => {
    const ats = computeAts({
      resumeKeywords: ['Go', 'Kafka', 'Observability'],
      required: ['Go', 'PostgreSQL'],
      nice: ['Kafka', 'Observability'],
    });
    expect(ats.score).toBe(60);
    expect(resolveOrder(APPLICATIONS.slice(0, 4), 'priority')[0]?.priority).toBe('high');
  });
});
