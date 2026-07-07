/**
 * Provider-agnostic interfaces for external job/company data sources.
 *
 * Each provider lives in `./providers/<id>.ts` and exports a `Provider` object
 * conforming to one of these contracts. The cron route + manual trigger fan
 * out across enabled providers via `registry.ts`.
 */

import type { IsoDateTime, Uuid } from '@/lib/types';

export type ProviderId =
  | 'adzuna'
  | 'themuse'
  | 'jsearch'
  | 'clearbit_logo'
  | 'linkedin'
  | 'glassdoor';

export type ProviderKind = 'jobs' | 'company' | 'logo' | 'salary';

/**
 * Normalised job listing returned by every JobProvider, regardless of source.
 *
 * Optional fields use `| undefined` (rather than `?:`) on purpose: provider
 * normalisers commonly produce `undefined` values, and the codebase's
 * `exactOptionalPropertyTypes` setting otherwise forces every site to spread
 * conditionally. Callers should still treat these as "may be missing".
 */
export type ExternalJob = {
  sourceProvider: ProviderId;
  sourceId: string;
  title: string;
  companyName: string;
  companyDomain?: string | undefined;
  location?: string | undefined;
  remote?: 'remote' | 'hybrid' | 'onsite' | 'unknown' | undefined;
  salaryMin?: number | undefined;
  salaryMax?: number | undefined;
  currency?: string | undefined;
  postedAt?: IsoDateTime | undefined;
  applyUrl?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  /** Anything provider-specific lives here for forensic/debug purposes. */
  raw: unknown;
};

/** Search criteria sent into a JobProvider.searchJobs(). */
export type JobSearchQuery = {
  keywords?: string[];
  location?: string;
  remote?: 'remote' | 'hybrid' | 'onsite';
  minSalary?: number;
  page?: number;
  pageSize?: number;
};

export type ExternalCompany = {
  sourceProvider: ProviderId;
  sourceId: string;
  name: string;
  domain?: string | undefined;
  industry?: string | undefined;
  size?: string | undefined;
  hq?: string | undefined;
  founded?: number | undefined;
  description?: string | undefined;
  logoUrl?: string | undefined;
  raw: unknown;
};

export type CompanyLookup = {
  domain?: string | undefined;
  name?: string | undefined;
};

/**
 * Outcome of a single provider call. The cron + manual trigger persist this
 * shape into `api_call_log` regardless of which provider produced it.
 */
export type ProviderCallReport = {
  providerId: ProviderId;
  requestPath: string;
  httpStatus: number;
  latencyMs: number;
  rateLimitRemaining?: number | undefined;
  ownerUserId?: Uuid | undefined;
  error?: string | undefined;
};

export interface JobProvider {
  readonly id: ProviderId;
  readonly kind: 'jobs';
  searchJobs(query: JobSearchQuery): Promise<{
    jobs: ExternalJob[];
    report: ProviderCallReport;
  }>;
}

export interface CompanyProvider {
  readonly id: ProviderId;
  readonly kind: 'company' | 'logo';
  lookupCompany(query: CompanyLookup): Promise<{
    company: ExternalCompany | null;
    report: ProviderCallReport;
  }>;
}

export type AnyProvider = JobProvider | CompanyProvider;
