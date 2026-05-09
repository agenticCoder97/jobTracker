/**
 * Clearbit Logo provider — TEMPLATE.
 *
 * Public CDN keyed off domain. No API call here at runtime; the URL is
 * derived synchronously and we cache the success/404 in `external_companies`.
 */

import 'server-only';

import type { CompanyProvider, ExternalCompany } from '@/lib/api/types';

export const clearbitLogo: CompanyProvider = {
  id: 'clearbit_logo',
  kind: 'logo',
  async lookupCompany(query) {
    if (!query.domain) {
      return {
        company: null,
        report: {
          providerId: 'clearbit_logo',
          requestPath: '/(no-domain)',
          httpStatus: 400,
          latencyMs: 0,
          error: 'domain required',
        },
      };
    }

    const startedAt = Date.now();
    const logoUrl = `https://logo.clearbit.com/${encodeURIComponent(query.domain)}`;
    let httpStatus = 200;
    let error: string | undefined;
    try {
      const res = await fetch(logoUrl, { method: 'HEAD' });
      httpStatus = res.status;
      if (!res.ok) error = `${res.status} ${res.statusText}`;
    } catch (e) {
      httpStatus = 0;
      error = e instanceof Error ? e.message : String(e);
    }

    const company: ExternalCompany | null = error
      ? null
      : {
          sourceProvider: 'clearbit_logo',
          sourceId: query.domain,
          name: query.name ?? query.domain,
          domain: query.domain,
          logoUrl,
          raw: { logoUrl },
        };

    return {
      company,
      report: {
        providerId: 'clearbit_logo',
        requestPath: `/${query.domain}`,
        httpStatus,
        latencyMs: Date.now() - startedAt,
        ...(error ? { error } : {}),
      },
    };
  },
};
