import { afterEach, describe, expect, test, vi } from 'vitest';

describe('seed gating by persistence adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('local adapter seeds the demo board', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'local');
    vi.resetModules();
    const { useAppsStore } = await import('@/lib/store/apps-store');
    expect(useAppsStore.getState().applications.length).toBeGreaterThan(0);
  });

  test('supabase adapter starts the board empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const { useAppsStore } = await import('@/lib/store/apps-store');
    expect(useAppsStore.getState().applications).toEqual([]);
    expect(useAppsStore.getState().activity).toEqual({});
    expect(useAppsStore.getState().appDocs).toEqual({});
  });

  test('supabase adapter starts the document library empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const { useProfileStore } = await import('@/lib/store/profile-store');
    expect(useProfileStore.getState().resumes).toEqual([]);
    expect(useProfileStore.getState().coverLetters).toEqual([]);
  });

  test('supabase-mode reset stays empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const { useAppsStore } = await import('@/lib/store/apps-store');
    useAppsStore.getState().createCard({ status: 'applied', companyName: 'X', role: 'Y' });
    useAppsStore.getState().reset();
    expect(useAppsStore.getState().applications).toEqual([]);
  });
});
