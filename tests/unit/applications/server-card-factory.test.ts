import { describe, expect, test } from 'vitest';
import { DEMO_USER_ID } from '@/lib/types';
import { createServerApplicationBundle } from '@/lib/applications/server-card-factory';

describe('createServerApplicationBundle', () => {
  test('creates applied application with normal card defaults', () => {
    const bundle = createServerApplicationBundle({
      companyName: 'Acme',
      role: 'Staff Backend Engineer',
      applied: '2026-07-07',
      source: 'Outlook',
      postingUrl: 'https://jobs.example.com/123',
      description: 'We received your application.',
    });

    expect(bundle.application.ownerUserId).toBe(DEMO_USER_ID);
    expect(bundle.application.status).toBe('applied');
    expect(bundle.application.companyName).toBe('Acme');
    expect(bundle.application.companyLogoUrl).toContain('https://img.logo.dev/name/Acme?');
    expect(bundle.application.companyLogoUrl).toContain('size=128');
    expect(bundle.application.role).toBe('Staff Backend Engineer');
    expect(bundle.application.source).toBe('Outlook');
    expect(bundle.application.applied).toBe('2026-07-07');
    expect(bundle.activity?.history[0]?.text).toContain('Imported from Outlook');
  });

  test('assigns a unique displayId to each bundle created in the same tick', () => {
    const make = () =>
      createServerApplicationBundle({
        companyName: 'Acme',
        role: 'Engineer',
        applied: '2026-07-07',
        source: 'Outlook',
      });
    const bundles = Array.from({ length: 5 }, make);
    const displayIds = bundles.map((bundle) => bundle.application.displayId);

    expect(new Set(displayIds).size).toBe(5);
  });
});
