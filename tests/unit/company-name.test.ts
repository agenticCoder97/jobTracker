import { describe, expect, test } from 'vitest';
import { slugifyCompanyId } from '@/lib/company-logos';
import { companyNameOf } from '@/lib/utils/company-name';

describe('slugifyCompanyId', () => {
  test('lowercases and hyphenates', () => {
    expect(slugifyCompanyId('Acme Corp')).toBe('acme-corp');
  });
  test('handles ampersands and punctuation', () => {
    expect(slugifyCompanyId('Bain & Company, Inc.')).toBe('bain-and-company-inc');
  });
  test('trims stray hyphens and falls back when empty', () => {
    expect(slugifyCompanyId('  --  ')).toBe('company');
  });
});

describe('companyNameOf', () => {
  test('prefers explicit companyName', () => {
    expect(companyNameOf({ company: 'acme-corp', companyName: 'Acme Corp' })).toBe('Acme Corp');
  });
  test('falls back to seeded company name', () => {
    expect(companyNameOf({ company: 'anthropic' })).toBe('Anthropic');
  });
  test('derives a display name for unknown slugs', () => {
    expect(companyNameOf({ company: 'acme-corp' })).toBe('Acme Corp');
  });
});
