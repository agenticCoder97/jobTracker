import { describe, expect, test } from 'vitest';
import {
  signImportCandidate,
  verifyImportCandidate,
  type UnsignedImportCandidate,
} from '@/lib/outlook/candidate-signing';

function candidate(): UnsignedImportCandidate {
  return {
    messageId: 'message-1',
    internetMessageId: '<message-1@example.com>',
    subject: 'Application submitted',
    fromName: 'Acme Recruiting',
    fromAddress: 'recruiting@acme.example',
    receivedAt: '2026-07-07T12:00:00.000Z',
    webLink: 'https://outlook.example/message-1',
    bodyPreview: 'Thanks for applying to Acme.',
    confidence: 'high',
    score: 94,
    reasons: ['Known application confirmation language', 'Sender is recruiting team'],
    extracted: {
      companyName: 'Acme',
      role: 'Senior Software Engineer',
      source: 'outlook',
      applied: '2026-07-07',
      postingUrl: 'https://jobs.example/acme/swe',
      location: 'Remote',
      description: 'Backend role',
    },
  };
}

describe('outlook import candidate signing', () => {
  test('verifies untampered candidates', () => {
    const payload = candidate();
    const signed = signImportCandidate(payload, 'scan signing secret');

    expect(verifyImportCandidate(signed, 'scan signing secret')).toEqual(payload);
  });

  test('uses stable object key ordering when signing', () => {
    const first = candidate();
    const second = {
      ...candidate(),
      extracted: {
        description: 'Backend role',
        location: 'Remote',
        postingUrl: 'https://jobs.example/acme/swe',
        applied: '2026-07-07',
        source: 'outlook',
        role: 'Senior Software Engineer',
        companyName: 'Acme',
      },
    };

    expect(signImportCandidate(first, 'scan signing secret').signature).toBe(
      signImportCandidate(second, 'scan signing secret').signature,
    );
  });

  test('rejects tampered payloads', () => {
    const signed = signImportCandidate(candidate(), 'scan signing secret');
    const tampered = {
      ...signed,
      payload: {
        ...signed.payload,
        score: 12,
      },
    };

    expect(() => verifyImportCandidate(tampered, 'scan signing secret')).toThrow(/signature/);
  });
});
