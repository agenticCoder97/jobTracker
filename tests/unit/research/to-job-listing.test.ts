import { describe, expect, test } from 'vitest';
import { toJobListing } from '@/lib/research/to-job-listing';
import type { ExternalJob } from '@/lib/api/types';

const base: ExternalJob = {
  sourceProvider: 'themuse',
  sourceId: '7',
  title: 'Senior React Engineer',
  companyName: 'Acme Corp',
  location: 'Remote',
  remote: 'remote',
  salaryMin: 120000,
  salaryMax: 160000,
  postedAt: '2026-07-01T00:00:00.000Z',
  applyUrl: 'https://acme.com/apply',
  tags: ['react'],
  raw: null,
};

describe('toJobListing', () => {
  test('maps external job to the UI shape with match + capitalised remote', () => {
    const listing = toJobListing(base, ['react']);
    expect(listing).toMatchObject({
      company: 'acme-corp',
      role: 'Senior React Engineer',
      location: 'Remote',
      remote: 'Remote',
      salaryMin: 120000,
      salaryMax: 160000,
      match: 100,
      tags: ['react'],
      saved: false,
    });
    expect(listing.id).toBe('themuse:7');
    expect(listing.displayId).toMatch(/^JOB-/);
  });

  test('defaults missing remote/salary/location safely', () => {
    const listing = toJobListing(
      { sourceProvider: 'themuse', sourceId: '9', title: 'Dev', companyName: 'X', raw: null },
      [],
    );
    expect(listing.remote).toBe('Onsite');
    expect(listing.salaryMin).toBe(0);
    expect(listing.location).toBe('—');
  });
});
