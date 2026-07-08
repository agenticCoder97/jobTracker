import { describe, expect, test } from 'vitest';
import { parseApplicationEmail } from '@/lib/outlook/parser';

describe('outlook application parser', () => {
  test('detects high-confidence Greenhouse confirmation', () => {
    const result = parseApplicationEmail({
      id: '1',
      internetMessageId: '<1@example.com>',
      subject: 'Thank you for applying to Senior Backend Engineer at Acme',
      receivedDateTime: '2026-07-07T12:00:00.000Z',
      from: { emailAddress: { name: 'Acme Recruiting', address: 'no-reply@greenhouse.io' } },
      bodyPreview: 'We received your application and our hiring team will review it.',
      webLink: 'https://outlook.office.com/mail/1',
      body: {
        contentType: 'html',
        content:
          '<p>Thank you for applying.</p><a href="https://boards.greenhouse.io/acme/jobs/123">Job posting</a>',
      },
    });

    expect(result?.confidence).toBe('high');
    expect(result?.extracted.companyName).toBe('Acme');
    expect(result?.extracted.role).toBe('Senior Backend Engineer');
    expect(result?.reasons).toContain('application confirmation phrase');
  });

  test('rejects job alerts', () => {
    const result = parseApplicationEmail({
      id: '2',
      subject: '10 new jobs for backend engineer',
      receivedDateTime: '2026-07-07T12:00:00.000Z',
      from: { emailAddress: { name: 'LinkedIn Jobs', address: 'jobs-noreply@linkedin.com' } },
      bodyPreview: 'New jobs matching your search.',
    });

    expect(result).toBeNull();
  });
});
