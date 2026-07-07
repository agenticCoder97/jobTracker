'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export type ProfileTab = 'overview' | 'resumes' | 'covers' | 'preferences' | 'activity';

const tabs: ProfileTab[] = ['overview', 'resumes', 'covers', 'preferences', 'activity'];

export function profileTabFromSearchParams(searchParams: URLSearchParams): ProfileTab {
  const tab = searchParams.get('tab') as ProfileTab | null;
  return tab && tabs.includes(tab) ? tab : 'overview';
}

export function useProfileTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = profileTabFromSearchParams(searchParams);
  return {
    tab,
    setTab: (next: ProfileTab) =>
      router.replace(next === 'overview' ? '/profile' : `/profile?tab=${next}`),
  };
}
