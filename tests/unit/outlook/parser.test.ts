import { describe, expect, test } from 'vitest';
import { parseApplicationEmail, parseRejectionEmail } from '@/lib/outlook/parser';

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

  test.each([
    {
      subject:
        "Application received for Senior Software Engineer - we're streaming your info to the right people 🚀",
      fromName: 'Confluent Talent Team',
      fromAddress: 'no-reply@ashbyhq.com',
      body: "Thanks for applying to the Senior Software Engineer role. We're thrilled you're exploring a future with Confluent.",
      company: 'Confluent',
      role: 'Senior Software Engineer',
    },
    {
      subject: 'Thank you for applying to Braze!',
      fromName: 'no-reply@braze.com',
      fromAddress: 'no-reply@braze.com',
      body: 'Thank you for your application for the Senior Platform Software Engineer II position! At Braze, we are thrilled to hear from you.',
      company: 'Braze',
      role: 'Senior Platform Software Engineer II',
    },
    {
      subject: 'Thank you for applying to Campus!',
      fromName: 'Campus Hiring Team',
      fromAddress: 'no-reply@ashbyhq.com',
      body: 'Thank you for applying for the Senior Software Engineer position at Campus! We received your application.',
      company: 'Campus',
      role: 'Senior Software Engineer',
    },
    {
      subject: 'Thank you for applying at Docusign',
      fromName: 'Docusign @ icims',
      fromAddress: 'docusign+autoreply@talent.icims.com',
      body: 'Thank you, your application has been received for the Software Engineer position with Docusign.',
      company: 'Docusign',
      role: 'Software Engineer',
    },
    {
      subject: 'Thank you for applying to Navan',
      fromName: 'no-reply@navan.com',
      fromAddress: 'no-reply@navan.com',
      body: "Thank you for your interest in Navan! We wanted to let you know we've received your application for our Senior Back-End Engineer opportunity.",
      company: 'Navan',
      role: 'Senior Back-End Engineer',
    },
    {
      subject: 'Thank you for applying to Applovin',
      fromName: 'noreply.hiring@applovin.com',
      fromAddress: 'noreply.hiring@applovin.com',
      body: "We appreciate your interest in working for AppLovin and the time you've invested in applying for the Backend Engineer, New Grad position. Your application has been received.",
      company: 'AppLovin',
      role: 'Backend Engineer, New Grad',
    },
    {
      subject: 'Thanks for applying to Backflip!',
      fromName: 'Backflip Hiring Team',
      fromAddress: 'no-reply@ashbyhq.com',
      body: 'Thank you for applying for the Software Engineer role at Backflip! We appreciate your interest.',
      company: 'Backflip',
      role: 'Software Engineer',
    },
  ])('extracts $company and $role from a real confirmation pattern', (sample) => {
    const result = parseApplicationEmail({
      id: `${sample.company}-1`,
      subject: sample.subject,
      receivedDateTime: '2026-07-15T12:00:00.000Z',
      from: { emailAddress: { name: sample.fromName, address: sample.fromAddress } },
      bodyPreview: sample.body,
    });

    expect(result?.extracted.companyName).toBe(sample.company);
    expect(result?.extracted.role).toBe(sample.role);
  });

  test.each([
    {
      subject: 'Thank you for applying to The Trade Desk',
      fromName: 'no-reply-recruiting@thetradedesk.com',
      fromAddress: 'no-reply-recruiting@thetradedesk.com',
      company: 'The Trade Desk',
    },
    {
      subject: 'Thank you for applying to IXL Learning!',
      fromName: 'IXL Recruiting',
      fromAddress: 'jobs@ixl.com',
      company: 'IXL Learning',
    },
  ])('keeps an honest role fallback when $company does not name the role', (sample) => {
    const result = parseApplicationEmail({
      id: `${sample.company}-unknown-role`,
      subject: sample.subject,
      receivedDateTime: '2026-07-15T12:00:00.000Z',
      from: { emailAddress: { name: sample.fromName, address: sample.fromAddress } },
      bodyPreview: `We received your application. Thank you for your interest in ${sample.company}.`,
    });

    expect(result?.extracted.companyName).toBe(sample.company);
    expect(result?.extracted.role).toBe('New application');
  });

  test('extracts a real Workday rejection email', () => {
    const result = parseRejectionEmail({
      id: 'visa-rejection-1',
      internetMessageId: '<visa-rejection@example.com>',
      subject: 'Visa - Application Update',
      receivedDateTime: '2026-07-10T17:03:02.000Z',
      from: { emailAddress: { name: 'Visa People Team', address: 'visa@myworkday.com' } },
      bodyPreview:
        'Thank you for taking the time to apply for the Staff Software Engineer position at 810 Visa Technology and Operations LLC. After careful review, we are unable to move forward with your application for this position.',
    });

    expect(result?.extracted).toEqual({
      companyName: 'Visa',
      role: 'Staff Software Engineer',
    });
    expect(result?.reason).toContain('unable to move forward');
  });

  test('does not classify a normal next-steps email as a rejection', () => {
    const result = parseRejectionEmail({
      id: 'positive-update',
      subject: 'Next steps for your application',
      receivedDateTime: '2026-07-10T17:03:02.000Z',
      bodyPreview: 'We are moving forward with your application and would like to schedule a call.',
    });

    expect(result).toBeNull();
  });
});
