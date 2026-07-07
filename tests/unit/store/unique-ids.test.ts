import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('new-card ids', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('createCard ids are random v4 uuids and never collide', () => {
    const ids = Array.from({ length: 30 }, (_, index) =>
      useAppsStore.getState().createCard({
        status: 'wishlist',
        companyName: `Co ${index}`,
        role: 'Engineer',
      }).id,
    );
    expect(new Set(ids).size).toBe(30);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  test('addToWishlist ids are random v4 uuids', () => {
    const app = useAppsStore.getState().addToWishlist({
      id: 'listing-1',
      company: 'anthropic',
      role: 'MTS',
      location: 'Remote',
      remote: 'Remote',
      salaryMin: 200,
      salaryMax: 300,
      posted: '2026-07-01',
      match: 90,
      tags: ['TS'],
    } as never);
    expect(app.id).toMatch(UUID_V4);
  });
});
