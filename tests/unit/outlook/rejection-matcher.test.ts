import { describe, expect, test } from 'vitest';

import type { RejectionEmailCandidate } from '@/lib/outlook/parser';
import { matchRejectionToApplication } from '@/lib/outlook/rejection-matcher';
import type { Application, StatusId } from '@/lib/types';

function application(
  id: string,
  companyName: string,
  role: string,
  status: StatusId = 'applied',
): Application {
  return {
    id,
    ownerUserId: 'owner',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    deletedAt: null,
    displayId: `JT-${id}`,
    status,
    company: companyName.toLowerCase().replace(/\s+/g, '-'),
    companyName,
    role,
    location: 'Remote',
    remote: 'Remote',
    salaryMin: 0,
    salaryMax: 0,
    level: 'Senior',
    team: 'Product',
    posted: '2026-07-01',
    applied: '2026-07-01',
    lastActivity: '2026-07-01T00:00:00.000Z',
    priority: 'med',
    source: 'Outlook',
    progress: 20,
    tags: [],
    sourceListingId: null,
    sortIndex: 0,
    archivedAt: null,
  };
}

function candidate(companyName: string, role: string): RejectionEmailCandidate {
  return {
    messageId: 'message-1',
    subject: 'Application update',
    fromName: 'Recruiting',
    fromAddress: 'no-reply@example.com',
    receivedAt: '2026-07-10T00:00:00.000Z',
    bodyPreview: 'We are unable to move forward.',
    reason: 'We are unable to move forward.',
    extracted: { companyName, role },
  };
}

describe('rejection application matcher', () => {
  test('matches legal Workday company names to the exact role', () => {
    const result = matchRejectionToApplication(
      candidate('810 Visa Technology and Operations LLC', 'Staff Software Engineer'),
      [application('1', 'Visa', 'Staff Software Engineer')],
    );

    expect(result?.application.id).toBe('1');
    expect(result?.method).toBe('company-and-role');
  });

  test('uses company-only matching only when one active application exists', () => {
    const result = matchRejectionToApplication(candidate('Acme', 'New application'), [
      application('1', 'Acme', 'Backend Engineer'),
      application('2', 'Other Co', 'Backend Engineer'),
    ]);

    expect(result?.application.id).toBe('1');
    expect(result?.method).toBe('unique-company');
  });

  test('skips ambiguous duplicate applications', () => {
    const result = matchRejectionToApplication(candidate('Acme', 'Backend Engineer'), [
      application('1', 'Acme', 'Backend Engineer'),
      application('2', 'Acme', 'Backend Engineer'),
    ]);

    expect(result).toBeNull();
  });

  test('does not move wishlist or offer cards automatically', () => {
    const result = matchRejectionToApplication(candidate('Acme', 'Backend Engineer'), [
      application('1', 'Acme', 'Backend Engineer', 'wishlist'),
      application('2', 'Acme', 'Backend Engineer', 'offer'),
    ]);

    expect(result).toBeNull();
  });
});
