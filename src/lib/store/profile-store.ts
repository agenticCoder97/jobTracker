'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedAll } from '@/lib/data/seed';
import type { CoverLetter, Resume, Uuid } from '@/lib/types';

const seed = seedAll();

type ProfileState = {
  resumes: Resume[];
  coverLetters: CoverLetter[];
  incrementResumeUse: (id: Uuid) => void;
  incrementCoverLetterUse: (id: Uuid) => void;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      resumes: seed.resumes,
      coverLetters: seed.coverLetters,
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
        set({ resumes: fresh.resumes, coverLetters: fresh.coverLetters });
      },
    }),
    {
      name: 'jobtracker:profile:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ resumes: state.resumes, coverLetters: state.coverLetters }),
    },
  ),
);
