'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedAll } from '@/lib/data/seed';
import { recordAudit } from '@/lib/store/audit';
import type { CoverLetter, IsoDateTime, Profile, Resume, Uuid } from '@/lib/types';

const seed = seedAll();

export type ProfileActivityKind =
  | 'about'
  | 'profile'
  | 'resume.add'
  | 'resume.remove'
  | 'resume.edit'
  | 'resume.default'
  | 'cover.add'
  | 'cover.remove'
  | 'cover.edit'
  | 'cover.default';

export type ProfileActivityEntry = {
  id: Uuid;
  kind: ProfileActivityKind;
  text: string;
  when: IsoDateTime;
};

type ProfileState = {
  profile: Profile;
  resumes: Resume[];
  coverLetters: CoverLetter[];
  activity: ProfileActivityEntry[];
  updateProfile: (patch: Partial<Profile>) => void;
  updateAbout: (text: string) => void;
  setDefaultResume: (id: Uuid) => void;
  setDefaultCoverLetter: (id: Uuid) => void;
  incrementResumeUse: (id: Uuid) => void;
  incrementCoverLetterUse: (id: Uuid) => void;
  addResume: (input: Omit<Resume, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => Resume;
  removeResume: (id: Uuid) => void;
  editResume: (id: Uuid, patch: Partial<Omit<Resume, 'id' | 'ownerUserId' | 'createdAt'>>) => void;
  addCoverLetter: (input: Omit<CoverLetter, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => CoverLetter;
  removeCoverLetter: (id: Uuid) => void;
  editCoverLetter: (id: Uuid, patch: Partial<Omit<CoverLetter, 'id' | 'ownerUserId' | 'createdAt'>>) => void;
  reset: () => void;
};

function entry(kind: ProfileActivityKind, text: string): ProfileActivityEntry {
  return { id: crypto.randomUUID(), kind, text, when: new Date().toISOString() };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: seed.profile,
      resumes: seed.resumes,
      coverLetters: seed.coverLetters,
      activity: [],
      updateProfile: (patch) => {
        set((state) => ({
          profile: { ...state.profile, ...patch, updatedAt: new Date().toISOString() },
          activity: [entry('profile', 'Profile updated'), ...state.activity],
        }));
        recordAudit('profile', get().profile.id, 'profile_changed', { fields: Object.keys(patch) });
      },
      updateAbout: (text) => {
        const about = text.trimEnd();
        if (!about || about.length > 2000) return;
        set((state) => ({
          profile: { ...state.profile, about, updatedAt: new Date().toISOString() },
          activity: [entry('about', 'About updated'), ...state.activity],
        }));
        recordAudit('profile', get().profile.id, 'about_changed');
      },
      setDefaultResume: (id) => {
        if (!get().resumes.some((resume) => resume.id === id)) return;
        set((state) => ({
          resumes: state.resumes.map((resume) => ({
            ...resume,
            isDefault: resume.id === id,
            updatedAt: resume.id === id ? new Date().toISOString() : resume.updatedAt,
          })),
          activity: [entry('resume.default', 'Default resume changed'), ...state.activity],
        }));
      },
      setDefaultCoverLetter: (id) => {
        if (!get().coverLetters.some((cl) => cl.id === id)) return;
        set((state) => ({
          coverLetters: state.coverLetters.map((coverLetter) => ({
            ...coverLetter,
            isDefault: coverLetter.id === id,
            updatedAt: coverLetter.id === id ? new Date().toISOString() : coverLetter.updatedAt,
          })),
          activity: [entry('cover.default', 'Default cover letter changed'), ...state.activity],
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
      addResume: (input) => {
        const now = new Date().toISOString();
        const ownerUserId = get().profile.ownerUserId;
        const resume: Resume = {
          ...input,
          id: crypto.randomUUID(),
          ownerUserId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        set((state) => ({
          resumes: [resume, ...state.resumes],
          activity: [entry('resume.add', `Resume added: ${resume.name}`), ...state.activity],
        }));
        return resume;
      },
      removeResume: (id) => {
        const target = get().resumes.find((resume) => resume.id === id);
        if (!target) return;
        set((state) => ({
          resumes: state.resumes.filter((resume) => resume.id !== id),
          activity: [entry('resume.remove', `Resume removed: ${target.name}`), ...state.activity],
        }));
      },
      editResume: (id, patch) => {
        set((state) => ({
          resumes: state.resumes.map((resume) =>
            resume.id === id ? { ...resume, ...patch, updatedAt: new Date().toISOString() } : resume,
          ),
          activity: [entry('resume.edit', 'Resume edited'), ...state.activity],
        }));
      },
      addCoverLetter: (input) => {
        const now = new Date().toISOString();
        const ownerUserId = get().profile.ownerUserId;
        const coverLetter: CoverLetter = {
          ...input,
          id: crypto.randomUUID(),
          ownerUserId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        set((state) => ({
          coverLetters: [coverLetter, ...state.coverLetters],
          activity: [entry('cover.add', `Cover letter added: ${coverLetter.name}`), ...state.activity],
        }));
        return coverLetter;
      },
      removeCoverLetter: (id) => {
        const target = get().coverLetters.find((cl) => cl.id === id);
        if (!target) return;
        set((state) => ({
          coverLetters: state.coverLetters.filter((cl) => cl.id !== id),
          activity: [entry('cover.remove', `Cover letter removed: ${target.name}`), ...state.activity],
        }));
      },
      editCoverLetter: (id, patch) => {
        set((state) => ({
          coverLetters: state.coverLetters.map((cl) =>
            cl.id === id ? { ...cl, ...patch, updatedAt: new Date().toISOString() } : cl,
          ),
          activity: [entry('cover.edit', 'Cover letter edited'), ...state.activity],
        }));
      },
      reset: () => {
        const fresh = seedAll();
        set({
          profile: fresh.profile,
          resumes: fresh.resumes,
          coverLetters: fresh.coverLetters,
          activity: [],
        });
        recordAudit('demo', 'profile', 'reset');
      },
    }),
    {
      name: 'jobtracker:profile:v1',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profile: state.profile,
        resumes: state.resumes,
        coverLetters: state.coverLetters,
        activity: state.activity,
      }),
      migrate: (persistedState) => persistedState as ProfileState,
    },
  ),
);
