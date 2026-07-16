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
    expect(source?.src).toContain('size=44');
    expect(source?.src).toContain('format=png');
    expect(source?.src).toContain('retina=true');
    expect(source?.src).toContain('fallback=404');
  });

  test('uses the bundled Logo.dev publishable key when no override is configured', () => {
    const [source] = getCompanyLogoSources(stripe, 32);

    expect(source?.kind).toBe('logo-dev');
    expect(source?.src).toContain('token=pk_DxDDkkPsRtKwBfYjNH6yHQ');
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

  test('keeps Simple Icons as the fallback after Logo.dev', () => {
    const sources = getCompanyLogoSources(stripe, 32);

    expect(sources[1]).toMatchObject({
      kind: 'simple-icons',
      src: 'https://cdn.simpleicons.org/stripe',
    });
  });

  test('preserves an exact company name for name-based lookups', () => {
    const company = resolveLogoCompany('j-p-morgan', undefined, 'J.P. Morgan');
    const [source] = getCompanyLogoSources(company, 32);

    expect(company.name).toBe('J.P. Morgan');
    expect(source?.src).toContain('https://img.logo.dev/name/J.P.%20Morgan?');
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
