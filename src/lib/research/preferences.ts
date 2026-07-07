export type SearchRemote = 'remote' | 'hybrid' | 'onsite' | 'any';

export type SearchPreferences = {
  keywords: string[];
  location: string;
  remote: SearchRemote;
};

export const DEFAULT_SEARCH_PREFERENCES: SearchPreferences = {
  keywords: [],
  location: '',
  remote: 'any',
};

const REMOTE_VALUES: SearchRemote[] = ['remote', 'hybrid', 'onsite', 'any'];

function dedupeLower(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0)),
  );
}

export function normalizeSearchPreferences(input: Partial<SearchPreferences>): SearchPreferences {
  const remote = REMOTE_VALUES.includes(input.remote as SearchRemote)
    ? (input.remote as SearchRemote)
    : 'any';
  return {
    keywords: dedupeLower(input.keywords ?? []),
    location: (input.location ?? '').trim(),
    remote,
  };
}

/** Union of preference keywords + resume-derived keywords, lowercased & deduped. */
export function preferenceKeywords(prefs: SearchPreferences, resumeKeywords: string[]): string[] {
  return dedupeLower([...prefs.keywords, ...resumeKeywords]);
}
