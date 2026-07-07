/**
 * Glassdoor company provider — STUB.
 *
 * ⚠️ Glassdoor's public Affiliate API was deprecated in 2021. There is no
 *    free public replacement. Direct scraping is forbidden by their ToS.
 *    This stub stays here so the registry is complete and so a future
 *    operator with a partner agreement can drop in their own client.
 */

import 'server-only';

import type { CompanyProvider } from '@/lib/api/types';

export const glassdoor: CompanyProvider = {
  id: 'glassdoor',
  kind: 'company',
  async lookupCompany() {
    return {
      company: null,
      report: {
        providerId: 'glassdoor',
        requestPath: '/(stub)',
        httpStatus: 0,
        latencyMs: 0,
        error: 'glassdoor provider disabled — public API deprecated',
      },
    };
  },
};
