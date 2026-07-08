import type { ExternalJob } from '@/lib/api/types';

export type MatchProfile = {
  keywords?: string[];
  requiredSkills?: string[];
  preferredTitles?: string[];
  locations?: string[];
  remote?: 'remote' | 'hybrid' | 'onsite' | 'any';
};

const TERM_ALIASES: Record<string, string[]> = {
  'rest microservices': ['restful services', 'rest apis', 'rest api', 'micro-services'],
  microservices: ['micro-services', 'service oriented', 'distributed services'],
  java: ['j2ee', 'jdk', 'jvm'],
  kafka: ['aws msk', 'msk', 'event streaming'],
  postgresql: ['postgres'],
  docker: ['containers', 'containerized'],
  kubernetes: ['k8s'],
  'spring boot': ['springboot', 'spring framework'],
  rbac: ['role based access control', 'role-based access control'],
  'ci/cd': ['cicd', 'jenkins pipeline', 'jenkins'],
  aws: ['amazon web services', 'bedrock', 'msk'],
  'microsoft entra id': ['entra id', 'azure ad', 'oidc', 'msal'],
};

/**
 * Deterministic 0–100 resume/job score. It stays dependency-free for cron
 * reliability but goes beyond substring overlap with phrase aliases, title /
 * seniority fit, required-skill coverage, location/remote fit, and recency.
 */
export function computeMatchScore(
  job: ExternalJob,
  keywords: string[],
  profile: MatchProfile = {},
): number {
  const distinct = cleanTerms([...(profile.keywords ?? []), ...keywords]);
  if (distinct.length === 0) return 50;

  const title = normalize(job.title);
  const description = normalize(job.description ?? '');
  const tags = normalize((job.tags ?? []).join(' '));
  const haystack = normalize([title, description, tags].join(' '));

  const keywordScore = ratioScore(distinct, haystack);
  if (!hasProfile(profile)) return keywordScore;

  const requiredSkillScore = ratioScore(cleanTerms(profile.requiredSkills ?? []), haystack);
  const titleScore = titleFitScore(title, cleanTerms(profile.preferredTitles ?? []));
  const remoteScore = remoteFitScore(job.remote, profile.remote);
  const locationScore = locationFitScore(job.location, profile.locations ?? []);
  const recencyScore = recencyFitScore(job.postedAt);
  const seniorityScore = seniorityFitScore(title);

  return clamp(
    Math.round(
      keywordScore * 0.38 +
        requiredSkillScore * 0.22 +
        titleScore * 0.16 +
        remoteScore * 0.08 +
        locationScore * 0.06 +
        recencyScore * 0.05 +
        seniorityScore * 0.05,
    ),
  );
}

function cleanTerms(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(normalize).filter((value) => value.length > 0)));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ratioScore(terms: string[], haystack: string): number {
  if (terms.length === 0) return 50;
  const hits = terms.filter((term) => termMatches(term, haystack)).length;
  return clamp(Math.round((hits / terms.length) * 100));
}

function termMatches(term: string, haystack: string): boolean {
  if (haystack.includes(term)) return true;
  return (TERM_ALIASES[term] ?? []).some((alias) => haystack.includes(normalize(alias)));
}

function titleFitScore(title: string, preferredTitles: string[]): number {
  if (preferredTitles.length === 0) return 50;
  if (preferredTitles.some((preferred) => title.includes(preferred))) return 100;
  const titleTokens = new Set(title.split(' '));
  const best = Math.max(
    ...preferredTitles.map((preferred) => {
      const tokens = preferred.split(' ').filter(Boolean);
      const hits = tokens.filter((token) => titleTokens.has(token)).length;
      return tokens.length ? Math.round((hits / tokens.length) * 100) : 0;
    }),
  );
  return clamp(best);
}

function seniorityFitScore(title: string): number {
  if (/\b(principal|staff|lead|architect)\b/.test(title)) return 92;
  if (/\bsenior\b|\bsr\b/.test(title)) return 100;
  if (/\bjunior\b|\bintern\b|\bentry\b/.test(title)) return 15;
  return 65;
}

function remoteFitScore(
  jobRemote: ExternalJob['remote'],
  preferred: MatchProfile['remote'],
): number {
  if (!preferred || preferred === 'any' || !jobRemote || jobRemote === 'unknown') return 65;
  if (jobRemote === preferred) return 100;
  if (preferred === 'hybrid' && jobRemote === 'remote') return 85;
  if (preferred === 'remote' && jobRemote === 'hybrid') return 75;
  return 25;
}

function locationFitScore(
  location: string | undefined,
  preferredLocations: readonly string[],
): number {
  const cleanedLocation = normalize(location ?? '');
  const cleanedPreferred = preferredLocations.map(normalize).filter(Boolean);
  if (!cleanedLocation || cleanedPreferred.length === 0) return 60;
  if (cleanedPreferred.some((preferred) => cleanedLocation.includes(preferred))) return 100;
  if (/\b(remote|united states|usa|us)\b/.test(cleanedLocation)) return 80;
  if (
    /\b(san jose|sunnyvale|mountain view|palo alto|cupertino|san francisco|bay area)\b/.test(
      cleanedLocation,
    )
  ) {
    return 90;
  }
  return 35;
}

function recencyFitScore(postedAt: string | undefined): number {
  if (!postedAt) return 70;
  const posted = Date.parse(postedAt);
  if (Number.isNaN(posted)) return 70;
  const days = (Date.now() - posted) / 86_400_000;
  if (days <= 3) return 100;
  if (days <= 14) return 85;
  if (days <= 30) return 65;
  return 40;
}

function hasProfile(profile: MatchProfile): boolean {
  return Boolean(
    profile.requiredSkills?.length ||
    profile.preferredTitles?.length ||
    profile.locations?.length ||
    profile.remote,
  );
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, score));
}
