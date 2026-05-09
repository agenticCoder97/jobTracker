'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedAll } from '@/lib/data/seed';
import type { CoverLetter, Profile, Resume, Uuid } from '@/lib/types';

const seed = seedAll();

type ProfileState = {
  profile: Profile;
  resumes: Resume[];
  coverLetters: CoverLetter[];
  updateProfile: (patch: Partial<Profile>) => void;
  updateAbout: (text: string) => void;
  setDefaultResume: (id: Uuid) => void;
  setDefaultCoverLetter: (id: Uuid) => void;
  incrementResumeUse: (id: Uuid) => void;
  incrementCoverLetterUse: (id: Uuid) => void;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: seed.profile,
      resumes: seed.resumes,
      coverLetters: seed.coverLetters,
      updateProfile: (patch) => {
        set((state) => ({
          profile: { ...state.profile, ...patch, updatedAt: new Date().toISOString() },
        }));
      },
      updateAbout: (text) => {
        const about = text.trimEnd();
        if (!about || about.length > 2000) return;
        set((state) => ({
          profile: { ...state.profile, about, updatedAt: new Date().toISOString() },
        }));
      },
      setDefaultResume: (id) => {
        set((state) => ({
          resumes: state.resumes.map((resume) => ({
            ...resume,
            isDefault: resume.id === id,
            updatedAt: resume.id === id ? new Date().toISOString() : resume.updatedAt,
          })),
        }));
      },
      setDefaultCoverLetter: (id) => {
        set((state) => ({
          coverLetters: state.coverLetters.map((coverLetter) => ({
            ...coverLetter,
            isDefault: coverLetter.id === id,
            updatedAt: coverLetter.id === id ? new Date().toISOString() : coverLetter.updatedAt,
          })),
        }));
      },
      incrementResumeUse: (id) => {
        set((state) => ({
          resumes: state.resumes.map((resume) =>
            resume.id === id
              ? { ...resume, timesUsed: resume.timesUsed + 1, updatedAt: new Date().toISOString() }
              : resume,
          ),
        }));
      },
      incrementCoverLetterUse: (id) => {
        set((state) => ({
          coverLetters: state.coverLetters.map((coverLetter) =>
            coverLetter.id === id
              ? {
                  ...coverLetter,
                  timesUsed: coverLetter.timesUsed + 1,
                  updatedAt: new Date().toISOString(),
                }
              : coverLetter,
          ),
        }));
      },
      reset: () => {
        const fresh = seedAll();
        set({ profile: fresh.profile, resumes: fresh.resumes, coverLetters: fresh.coverLetters });
      },
    }),
    {
      name: 'jobtracker:profile:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profile: state.profile,
        resumes: state.resumes,
        coverLetters: state.coverLetters,
      }),
    },
  ),
);
