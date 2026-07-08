import type { UnsignedImportCandidate } from '@/lib/outlook/candidate-signing';

export type GraphMessage = {
  id: string;
  internetMessageId?: string | undefined;
  subject?: string | undefined;
  receivedDateTime: string;
  from?: { emailAddress?: { name?: string | undefined; address?: string | undefined } } | undefined;
  bodyPreview?: string | undefined;
  webLink?: string | undefined;
  body?: { contentType?: string | undefined; content?: string | undefined } | undefined;
};

const positivePhrases = [
  'thank you for applying',
  'thanks for applying',
  'application received',
  'received your application',
  'we received your application',
  'your application for',
  'your application to',
];

const rejectPhrases = ['new jobs', 'job alert', 'recommended jobs', 'saved search', 'newsletter'];
const atsDomains = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workday.com',
  'smartrecruiters.com',
];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOf(message: GraphMessage): string {
  return [message.subject, message.bodyPreview, stripHtml(message.body?.content ?? '')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function extractCompanyAndRole(
  subject: string,
  fromName: string,
): { companyName: string; role: string } {
  const applyingTo = subject.match(/applying to\s+(.+?)\s+at\s+(.+)$/i);
  if (applyingTo) return { role: applyingTo[1]!.trim(), companyName: applyingTo[2]!.trim() };
  const applicationFor = subject.match(/application for\s+(.+?)\s+(?:at|with)\s+(.+)$/i);
  if (applicationFor)
    return { role: applicationFor[1]!.trim(), companyName: applicationFor[2]!.trim() };
  const cleanedCompany = fromName.replace(/\s*(recruiting|careers|talent|jobs)\s*$/i, '').trim();
  return { role: 'New application', companyName: cleanedCompany || 'Unknown company' };
}

function firstUrl(content: string): string | undefined {
  return content.match(/https?:\/\/[^\s"')<>]+/)?.[0];
}

export function parseApplicationEmail(message: GraphMessage): UnsignedImportCandidate | null {
  const subject = message.subject ?? '';
  const fromName = message.from?.emailAddress?.name ?? '';
  const fromAddress = message.from?.emailAddress?.address ?? '';
  const haystack = textOf(message);
  if (rejectPhrases.some((phrase) => haystack.includes(phrase))) return null;

  const reasons: string[] = [];
  let score = 0;
  if (positivePhrases.some((phrase) => haystack.includes(phrase))) {
    score += 60;
    reasons.push('application confirmation phrase');
  }
  if (atsDomains.some((domain) => fromAddress.toLowerCase().includes(domain))) {
    score += 20;
    reasons.push('ats sender');
  }
  if (subject.toLowerCase().includes('application')) score += 10;
  if (score < 45) return null;

  const extracted = extractCompanyAndRole(subject, fromName);
  const bodyContent = message.body?.content ?? '';
  const postingUrl = firstUrl(bodyContent);
  const confidence = score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low';
  return {
    messageId: message.id,
    ...(message.internetMessageId ? { internetMessageId: message.internetMessageId } : {}),
    subject,
    fromName,
    fromAddress,
    receivedAt: message.receivedDateTime,
    ...(message.webLink ? { webLink: message.webLink } : {}),
    bodyPreview: message.bodyPreview ?? '',
    confidence,
    score,
    reasons,
    extracted: {
      companyName: extracted.companyName,
      role: extracted.role,
      source: 'Outlook',
      applied: message.receivedDateTime.slice(0, 10),
      ...(postingUrl ? { postingUrl } : {}),
      description: stripHtml(bodyContent).slice(0, 1200),
    },
  };
}
