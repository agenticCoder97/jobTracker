import 'server-only';

import { slugifyCompanyId } from '@/lib/company-logos';
import type { AppBundle } from '@/lib/repositories/supabase/apps-repository';
import { DEMO_USER_ID, type Application } from '@/lib/types';

export type ServerApplicationInput = {
  companyName: string;
  role: string;
  applied: string;
  source: string;
  postingUrl?: string | undefined;
  location?: string | undefined;
  description?: string | undefined;
};

function displayId(): string {
  return `JT-${Date.now().toString(36).toUpperCase()}`;
}

export function createServerApplicationBundle(input: ServerApplicationInput): AppBundle {
  const now = new Date().toISOString();
  const application: Application = {
    id: crypto.randomUUID(),
    ownerUserId: DEMO_USER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    displayId: displayId(),
    status: 'applied',
    company: slugifyCompanyId(input.companyName),
    companyName: input.companyName.trim(),
    role: input.role.trim(),
    location: input.location?.trim() || 'Remote',
    remote: 'Remote',
    salaryMin: 0,
    salaryMax: 0,
    level: 'Senior',
    team: 'Product',
    posted: input.applied,
    applied: input.applied,
    lastActivity: now,
    priority: 'med',
    source: input.source,
    progress: 20,
    tags: ['Outlook'],
    sourceListingId: null,
    sortIndex: 0,
    archivedAt: null,
    ...(input.postingUrl ? { postingUrl: input.postingUrl } : {}),
    ...(input.description ? { description: input.description } : {}),
  };
  return {
    application,
    activity: {
      comments: [],
      links: input.postingUrl
        ? [
            {
              id: crypto.randomUUID(),
              type: 'posting',
              title: 'Original posting',
              meta: input.postingUrl,
            },
          ]
        : [],
      attachments: [],
      history: [
        {
          id: crypto.randomUUID(),
          type: 'created',
          who: 'me',
          when: now,
          text: 'Imported from Outlook application confirmation',
        },
      ],
    },
  };
}
