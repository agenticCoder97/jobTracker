/**
 * LinkedIn jobs provider — STUB.
 *
 * ⚠️ LinkedIn's public REST API requires Talent Solutions partner approval.
 *    Unauthenticated scraping of linkedin.com is forbidden by their ToS and
 *    is actively blocked. This stub exists so the architecture supports
 *    LinkedIn for an operator who has obtained partner credentials — it does
 *    NOT scrape and should remain a no-op until that condition is met.
 *
 * Recommended legal alternatives during development:
 *   - JSearch (RapidAPI) — partner-aggregated LinkedIn data.
 *   - User-uploaded LinkedIn profile PDF (out-of-band consent).
 */

import 'server-only';

import type { JobProvider } from '@/lib/api/types';

export const linkedin: JobProvider = {
  id: 'linkedin',
  kind: 'jobs',
  async searchJobs() {
    return {
      jobs: [],
      report: {
        providerId: 'linkedin',
        requestPath: '/(stub)',
        httpStatus: 0,
        latencyMs: 0,
        error: 'linkedin provider disabled — requires Talent Solutions partner approval',
      },
    };
  },
};
