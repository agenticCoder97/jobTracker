import { beforeEach, describe, expect, test } from 'vitest';
import { seedAll } from '@/lib/data/seed';
import { useProfileStore } from '@/lib/store/profile-store';

describe('Plan 3 seed data', () => {
  test('includes profile and research datasets', () => {
    const seed = seedAll();
    expect(seed.profile.name).toBe('Nikhil Netraganti');
    expect(seed.profile.completeness.sections).toHaveLength(8);
    expect(seed.dailyPicks).toHaveLength(6);
    expect(seed.marketSalaries.length).toBeGreaterThan(4);
    expect(seed.linkedinSuggested).toHaveLength(4);
    expect(seed.companiesWatch.length).toBeGreaterThan(5);
  });
});

describe('Plan 3 profile store', () => {
  beforeEach(() => {
    useProfileStore.getState().reset();
  });

  test('updates about text and document defaults', () => {
    const originalUpdated = useProfileStore.getState().profile.updatedAt;
    useProfileStore.getState().updateAbout('Line one\nLine two   ');
    expect(useProfileStore.getState().profile.about).toBe('Line one\nLine two');
    expect(useProfileStore.getState().profile.updatedAt).not.toBe(originalUpdated);

    const resume = useProfileStore.getState().resumes.find((item) => !item.isDefault);
    expect(resume).toBeDefined();
    useProfileStore.getState().setDefaultResume(resume!.id);
    expect(
      useProfileStore.getState().resumes.find((item) => item.id === resume!.id)?.isDefault,
    ).toBe(true);

    const cover = useProfileStore.getState().coverLetters.find((item) => !item.isDefault);
    expect(cover).toBeDefined();
    useProfileStore.getState().setDefaultCoverLetter(cover!.id);
    expect(
      useProfileStore.getState().coverLetters.find((item) => item.id === cover!.id)?.isDefault,
    ).toBe(true);
  });
});
