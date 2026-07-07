import { describe, expect, test } from 'vitest';
import { toDailyPick } from '@/lib/research/to-daily-pick';

describe('toDailyPick', () => {
  test('formats salary band and why-bullets', () => {
    const pick = toDailyPick(
      {
        sourceProvider: 'themuse',
        sourceId: '5',
        title: 'Staff Eng',
        companyName: 'Globex',
        location: 'NYC',
        salaryMin: 180000,
        salaryMax: 220000,
        tags: ['go'],
        raw: null,
      },
      92,
    );
    expect(pick.company).toBe('globex');
    expect(pick.role).toBe('Staff Eng');
    expect(pick.match).toBe(92);
    expect(pick.salary).toMatch(/\$180/);
    expect(Array.isArray(pick.why)).toBe(true);
    expect(pick.id).toBe('themuse:5');
  });
});
