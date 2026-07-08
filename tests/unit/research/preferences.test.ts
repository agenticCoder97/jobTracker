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

  test('default preferences target Nikhil senior backend search', () => {
    expect(DEFAULT_SEARCH_PREFERENCES.location).toBe('Santa Clara, CA');
    expect(DEFAULT_SEARCH_PREFERENCES.remote).toBe('hybrid');
    expect(DEFAULT_SEARCH_PREFERENCES.keywords).toEqual(
      expect.arrayContaining(['senior java engineer', 'spring boot', 'microservices', 'kafka']),
    );
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

  test('empty keyword preferences fall back to Nikhil resume defaults', () => {
    const prefs = normalizeSearchPreferences({ keywords: [], location: '', remote: 'any' });
    expect(prefs.keywords).toContain('spring boot');
    expect(prefs.location).toBe('Santa Clara, CA');
    expect(prefs.remote).toBe('hybrid');
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
