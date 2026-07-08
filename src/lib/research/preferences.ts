import type { MatchProfile } from '@/lib/research/match-score';

export type SearchRemote = 'remote' | 'hybrid' | 'onsite' | 'any';

export type SearchPreferences = {
  keywords: string[];
  location: string;
  remote: SearchRemote;
};

export const NIKHIL_RESUME_KEYWORDS = [
  'senior java engineer',
  'spring boot',
  'spring',
  'java',
  'rest microservices',
  'microservices',
  'kafka',
  'aws',
  'docker',
  'kubernetes',
  'postgresql',
  'oracle',
  'sql',
  'redis',
  'junit',
  'mockito',
  'react',
  'redux',
  'python',
  'backend engineer',
  'healthcare',
  'medicare',
  'medicaid',
  'api batch processing',
  'ci/cd',
  'jenkins',
];

export const DEFAULT_SEARCH_PREFERENCES: SearchPreferences = {
  keywords: [
    'senior java engineer',
    'spring boot',
    'backend engineer',
    'microservices',
    'kafka',
    'healthcare software engineer',
  ],
  location: 'Santa Clara, CA',
  remote: 'hybrid',
};

export const DEFAULT_MATCH_PROFILE: MatchProfile = {
  keywords: NIKHIL_RESUME_KEYWORDS,
  requiredSkills: ['java', 'spring boot', 'sql', 'rest microservices'],
  preferredTitles: [
    'senior java engineer',
    'senior software engineer',
    'backend engineer',
    'spring boot engineer',
    'platform engineer',
  ],
  locations: ['santa clara', 'san jose', 'sunnyvale', 'mountain view', 'palo alto', 'bay area'],
  remote: 'hybrid',
};

const REMOTE_VALUES: SearchRemote[] = ['remote', 'hybrid', 'onsite', 'any'];

function dedupeLower(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0)));
}

export function normalizeSearchPreferences(input: Partial<SearchPreferences>): SearchPreferences {
  const inputRemote = input.remote as SearchRemote | undefined;
  const remote =
    inputRemote === undefined || inputRemote === 'any'
      ? DEFAULT_SEARCH_PREFERENCES.remote
      : REMOTE_VALUES.includes(inputRemote)
        ? inputRemote
        : 'any';
  const keywords = dedupeLower(input.keywords ?? []);
  return {
    keywords: keywords.length ? keywords : dedupeLower(DEFAULT_SEARCH_PREFERENCES.keywords),
    location: (input.location ?? '').trim() || DEFAULT_SEARCH_PREFERENCES.location,
    remote,
  };
}

/** Union of preference keywords + resume-derived keywords, lowercased & deduped. */
export function preferenceKeywords(prefs: SearchPreferences, resumeKeywords: string[]): string[] {
  return dedupeLower([...prefs.keywords, ...resumeKeywords]);
}
