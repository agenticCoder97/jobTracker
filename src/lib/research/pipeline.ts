import 'server-only';

import type { ExternalJob, JobSearchQuery, ProviderCallReport } from '@/lib/api/types';
import { listJobProviders } from '@/lib/api/registry';
import { deriveCompaniesFromJobs } from '@/lib/research/derive-companies';
import { getSearchPreferences } from '@/lib/repositories/supabase/research-preferences-repository';
import {
  upsertExternalCompanies,
  upsertExternalJobs,
} from '@/lib/repositories/supabase/research-repository';
import { getApiCallLogRepository } from '@/lib/repositories/server';

export type ResearchRunSummary = {
  providersCalled: number;
  jobsUpserted: number;
  companiesUpserted: number;
  errors: Array<{ providerId: string; error: string }>;
};

function toQuery(keywords: string[], location: string, remote: string): JobSearchQuery {
  return {
    ...(keywords.length ? { keywords } : {}),
    ...(location ? { location } : {}),
    ...(remote === 'remote' || remote === 'hybrid' || remote === 'onsite' ? { remote } : {}),
    pageSize: 20,
  };
}

export async function runResearchRefresh(): Promise<ResearchRunSummary> {
  const prefs = await getSearchPreferences();
  const query = toQuery(prefs.keywords, prefs.location, prefs.remote);

  const providers = listJobProviders();
  const reports: ProviderCallReport[] = [];
  const errors: Array<{ providerId: string; error: string }> = [];
  const allJobs: ExternalJob[] = [];

  for (const provider of providers) {
    try {
      const { jobs, report } = await provider.searchJobs(query);
      reports.push(report);
      if (report.error) errors.push({ providerId: provider.id, error: report.error });
      allJobs.push(...jobs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ providerId: provider.id, error: message });
      reports.push({
        providerId: provider.id,
        requestPath: '/error',
        httpStatus: 0,
        latencyMs: 0,
        error: message,
      });
    }
  }

  await upsertExternalJobs(allJobs);
  const companies = deriveCompaniesFromJobs(allJobs);
  await upsertExternalCompanies(companies);

  const apiCallLog = getApiCallLogRepository();
  for (const report of reports) {
    await apiCallLog.append({
      providerId: report.providerId,
      requestPath: report.requestPath,
      httpStatus: report.httpStatus,
      latencyMs: report.latencyMs,
      ...(report.rateLimitRemaining !== undefined
        ? { rateLimitRemaining: report.rateLimitRemaining }
        : {}),
      ...(report.ownerUserId ? { ownerUserId: report.ownerUserId } : {}),
      ...(report.error ? { error: report.error } : {}),
    });
  }

  return {
    providersCalled: providers.length,
    jobsUpserted: allJobs.length,
    companiesUpserted: companies.length,
    errors,
  };
}
