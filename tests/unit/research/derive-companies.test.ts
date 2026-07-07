import { describe, expect, test } from 'vitest';
import { deriveCompaniesFromJobs } from '@/lib/research/derive-companies';
import type { ExternalJob } from '@/lib/api/types';

function job(p: Partial<ExternalJob>): ExternalJob {
  return { sourceProvider: 'themuse', sourceId: '1', title: 'Eng', companyName: 'Acme', raw: null, ...p };
}

describe('deriveCompaniesFromJobs', () => {
  test('collapses jobs to one company per distinct name', () => {
    const companies = deriveCompaniesFromJobs([
      job({ sourceId: '1', companyName: 'Acme' }),
      job({ sourceId: '2', companyName: 'Acme' }),
      job({ sourceId: '3', companyName: 'Globex' }),
    ]);
    expect(companies).toHaveLength(2);
    expect(companies.map((c) => c.name).sort()).toEqual(['Acme', 'Globex']);
  });

  test('uses a stable source_id (slug) and carries domain + clearbit logo', () => {
    const [company] = deriveCompaniesFromJobs([
      job({ companyName: 'Acme Corp', companyDomain: 'acme.com' }),
    ]);
    expect(company!.sourceId).toBe('acme-corp');
    expect(company!.domain).toBe('acme.com');
    expect(company!.logoUrl).toBe('https://logo.clearbit.com/acme.com');
  });

  test('no domain → no logo, slug still stable', () => {
    const [company] = deriveCompaniesFromJobs([job({ companyName: 'No Domain Inc' })]);
    expect(company!.sourceId).toBe('no-domain-inc');
    expect(company!.domain).toBeUndefined();
    expect(company!.logoUrl).toBeUndefined();
  });

  test('skips jobs with an unknown/blank company name', () => {
    expect(deriveCompaniesFromJobs([job({ companyName: 'Unknown' }), job({ companyName: '' })])).toEqual([]);
  });
});
