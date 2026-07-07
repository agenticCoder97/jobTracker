import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SEARCH_PREFERENCES,
  normalizeSearchPreferences,
  preferenceKeywords,
} from '@/lib/research/preferences';

describe('search preferences', () => {
  test('normalize fills defaults for a partial/empty object', () => {
    expect(normalizeSearchPreferences({})).toEqual(DEFAULT_SEARCH_PREFERENCES);
  });

  test('normalize trims + dedupes + drops empty keywords', () => {
    const prefs = normalizeSearchPreferences({
      keywords: [' React ', 'react', '', 'TypeScript'],
      location: ' Remote ',
      remote: 'remote',
    });
    expect(prefs.keywords).toEqual(['react', 'typescript']);
    expect(prefs.location).toBe('Remote');
    expect(prefs.remote).toBe('remote');
  });

  test('normalize rejects an unknown remote value → any', () => {
    expect(normalizeSearchPreferences({ remote: 'martian' as never }).remote).toBe('any');
  });

  test('preferenceKeywords merges prefs + resume keywords, deduped', () => {
    const merged = preferenceKeywords(
      { keywords: ['react', 'node'], location: '', remote: 'any' },
      ['Node', 'GraphQL'],
    );
    expect(merged.sort()).toEqual(['graphql', 'node', 'react']);
  });
});
