import { describe, expect, test } from 'vitest';
import { toCompany } from '@/lib/research/to-company';

describe('toCompany', () => {
  test('maps external company to UI Company with slug id + initial', () => {
    const c = toCompany(
      {
        sourceProvider: 'themuse',
        sourceId: 'acme-corp',
        name: 'Acme Corp',
        domain: 'acme.com',
        logoUrl: 'https://logo.clearbit.com/acme.com',
        raw: null,
      },
      { openRoles: 3, watched: true },
    );
    expect(c.id).toBe('acme-corp');
    expect(c.name).toBe('Acme Corp');
    expect(c.initial).toBe('A');
    expect(c.domain).toBe('acme.com');
    expect(c.logoUrl).toBe('https://logo.clearbit.com/acme.com');
    expect(c.ring).toBe(true); // watched → ring
  });
});
