import type { RejectionEmailCandidate } from '@/lib/outlook/parser';
import type { Application } from '@/lib/types';

export type RejectionMatch = {
  application: Application;
  method: 'company-and-role' | 'unique-company';
  score: number;
};

const companyStopWords = new Set([
  'the',
  'and',
  'company',
  'corporation',
  'corp',
  'inc',
  'llc',
  'ltd',
  'limited',
  'group',
  'holdings',
  'technology',
  'technologies',
  'operations',
  'team',
  'talent',
  'people',
  'careers',
  'recruiting',
]);

function normalized(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string, stopWords = new Set<string>()): Set<string> {
  return new Set(
    normalized(value)
      .split(' ')
      .filter((token) => token && !/^\d+$/.test(token) && !stopWords.has(token)),
  );
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  return [...left].filter((token) => right.has(token)).length;
}

function isSubset(left: Set<string>, right: Set<string>): boolean {
  return [...left].every((token) => right.has(token));
}

function companyScore(candidate: string, application: Application): number {
  if (!candidate || candidate === 'Unknown company') return 0;
  const candidateTokens = tokenSet(candidate, companyStopWords);
  const applicationTokens = tokenSet(
    application.companyName ?? application.company,
    companyStopWords,
  );
  if (candidateTokens.size === 0 || applicationTokens.size === 0) return 0;
  const intersection = intersectionSize(candidateTokens, applicationTokens);
  if (intersection === 0) return 0;
  if (candidateTokens.size === applicationTokens.size && intersection === candidateTokens.size) {
    return 60;
  }
  if (
    isSubset(candidateTokens, applicationTokens) ||
    isSubset(applicationTokens, candidateTokens)
  ) {
    return 50;
  }
  const union = new Set([...candidateTokens, ...applicationTokens]).size;
  return intersection / union >= 0.5 ? 40 : 0;
}

function roleScore(candidate: string, application: Application): number {
  if (!candidate || candidate === 'New application') return 0;
  const candidateRole = normalized(candidate);
  const applicationRole = normalized(application.role);
  if (!candidateRole || !applicationRole) return 0;
  if (candidateRole === applicationRole) return 50;
  if (candidateRole.includes(applicationRole) || applicationRole.includes(candidateRole)) return 40;
  const candidateTokens = tokenSet(candidate);
  const applicationTokens = tokenSet(application.role);
  const intersection = intersectionSize(candidateTokens, applicationTokens);
  const union = new Set([...candidateTokens, ...applicationTokens]).size;
  return union > 0 && intersection / union >= 0.6 ? 35 : 0;
}

function eligible(application: Application): boolean {
  return (
    !application.deletedAt &&
    !application.archivedAt &&
    ['applied', 'screen', 'interview', 'rejected'].includes(application.status)
  );
}

export function matchRejectionToApplication(
  candidate: RejectionEmailCandidate,
  applications: Application[],
): RejectionMatch | null {
  const eligibleApplications = applications.filter(eligible);
  const hasRole = candidate.extracted.role !== 'New application';

  if (!hasRole) {
    const companyMatches = eligibleApplications
      .map((application) => ({
        application,
        score: companyScore(candidate.extracted.companyName, application),
      }))
      .filter((match) => match.score >= 50);
    if (companyMatches.length !== 1) return null;
    return { ...companyMatches[0]!, method: 'unique-company' };
  }

  const ranked = eligibleApplications
    .map((application) => {
      const company = companyScore(candidate.extracted.companyName, application);
      const role = roleScore(candidate.extracted.role, application);
      return { application, company, role, score: company + role };
    })
    .filter((match) => match.company >= 40 && match.role >= 35)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) return null;
  if (ranked[1] && ranked[0]!.score - ranked[1].score < 10) return null;
  return {
    application: ranked[0]!.application,
    method: 'company-and-role',
    score: ranked[0]!.score,
  };
}
