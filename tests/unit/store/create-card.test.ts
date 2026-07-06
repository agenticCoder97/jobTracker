import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

describe('createCard with input', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('creates a card with free-form company and details', () => {
    const app = useAppsStore.getState().createCard({
      status: 'applied',
      companyName: 'Acme Corp',
      role: 'Staff Engineer',
      location: 'Austin, TX',
      remote: 'Hybrid',
      salaryMin: 190,
      salaryMax: 250,
      priority: 'high',
      tags: ['Platform', 'Go'],
      postingUrl: 'https://acme.example/jobs/123',
      description: 'Platform team role.',
    });
    expect(app.company).toBe('acme-corp');
    expect(app.companyName).toBe('Acme Corp');
    expect(app.status).toBe('applied');
    expect(app.salaryMin).toBe(190);
    expect(app.postingUrl).toBe('https://acme.example/jobs/123');
    expect(app.displayId).toMatch(/^JT-\d+$/);
    const stored = useAppsStore.getState().getByDisplayId(app.displayId);
    expect(stored?.role).toBe('Staff Engineer');
    const history = useAppsStore.getState().activity[app.id]?.history ?? [];
    expect(history[0]?.text).toContain('created');
  });

  test('applies defaults when optional fields are omitted', () => {
    const app = useAppsStore.getState().createCard({
      status: 'wishlist',
      companyName: 'Tiny Startup',
      role: 'Engineer',
    });
    expect(app.company).toBe('tiny-startup');
    expect(app.location).toBe('Remote');
    expect(app.remote).toBe('Remote');
    expect(app.priority).toBe('med');
    expect(app.tags).toEqual([]);
    expect(app.progress).toBe(5);
  });
});
