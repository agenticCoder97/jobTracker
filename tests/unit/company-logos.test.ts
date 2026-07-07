import { afterEach, describe, expect, test } from 'vitest';
import type { Company } from '@/lib/types';
import { getCompanyLogoSources, getSimpleIconsSlug, resolveLogoCompany } from '@/lib/company-logos';

const stripe: Company = {
  id: 'stripe',
  name: 'Stripe',
  bg: '#635BFF',
  initial: 'S',
  domain: 'stripe.com',
};

describe('company logo resolver', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  });

  test('uses Logo.dev domain lookups when a publishable token and domain are present', () => {
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN = 'pk_test_123';

    const [source] = getCompanyLogoSources(stripe, 44);

    expect(source).toMatchObject({
      kind: 'logo-dev',
      referrerPolicy: 'origin',
    });
    expect(source?.src).toContain('https://img.logo.dev/stripe.com?');
    expect(source?.src).toContain('token=pk_test_123');
    expect(source?.src).toContain('size=88');
    expect(source?.src).toContain('format=png');
    expect(source?.src).toContain('fallback=404');
  });

  test('uses Logo.dev name lookups when only a company name is available', () => {
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN = 'pk_test_123';

    const [source] = getCompanyLogoSources(
      { id: 'acme-labs', name: 'Acme Labs', bg: '#111827', initial: 'A' },
      32,
    );

    expect(source?.kind).toBe('logo-dev');
    expect(source?.src).toContain('https://img.logo.dev/name/Acme%20Labs?');
  });

  test('falls back to Simple Icons CDN using normalized brand slugs', () => {
    const sources = getCompanyLogoSources(stripe, 32);

    expect(sources[0]).toMatchObject({
      kind: 'simple-icons',
      src: 'https://cdn.simpleicons.org/stripe',
    });
  });

  test('normalizes arbitrary company ids into display identities', () => {
    const company = resolveLogoCompany('acme-labs.ai');

    expect(company).toMatchObject({
      id: 'acme-labs.ai',
      name: 'Acme Labs',
      initial: 'A',
      domain: 'acme-labs.ai',
    });
    expect(getSimpleIconsSlug(company)).toBe('acmelabs');
  });
});
