import 'server-only';

import { adzuna } from '@/lib/api/providers/adzuna';
import { clearbitLogo } from '@/lib/api/providers/clearbit-logo';
import { glassdoor } from '@/lib/api/providers/glassdoor';
import { jsearch } from '@/lib/api/providers/jsearch';
import { linkedin } from '@/lib/api/providers/linkedin';
import { themuse } from '@/lib/api/providers/themuse';
import type { AnyProvider, JobProvider, ProviderId } from '@/lib/api/types';

const ALL_PROVIDERS: Record<ProviderId, AnyProvider> = {
  adzuna,
  themuse,
  jsearch,
  clearbit_logo: clearbitLogo,
  linkedin,
  glassdoor,
};

export function getProvider(id: ProviderId): AnyProvider {
  return ALL_PROVIDERS[id];
}

export function listJobProviders(): JobProvider[] {
  return Object.values(ALL_PROVIDERS).filter(
    (p): p is JobProvider => p.kind === 'jobs',
  );
}

export const PROVIDER_IDS = Object.keys(ALL_PROVIDERS) as ProviderId[];
