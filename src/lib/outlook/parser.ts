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
  'myworkday.com',
  'smartrecruiters.com',
];

const rejectionPhrases = [
  'not moving forward',
  'not be moving forward',
  'unable to move forward',
  'decided to move forward with other',
  'move forward with other candidates',
  'pursue other candidates',
  'not selected',
  'no longer under consideration',
  'position has been filled',
  'role has been filled',
  'regret to inform',
];

export type RejectionEmailCandidate = {
  messageId: string;
  internetMessageId?: string | undefined;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
  webLink?: string | undefined;
  bodyPreview: string;
  reason: string;
  extracted: {
    companyName: string;
    role: string;
  };
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function originalTextOf(message: GraphMessage): string {
  return [message.subject, message.bodyPreview, stripHtml(message.body?.content ?? '')]
    .filter(Boolean)
    .join('\n')
    .replace(/[\t\r\f\v ]+/g, ' ')
    .trim();
}

function textOf(message: GraphMessage): string {
  return originalTextOf(message).toLowerCase();
}

function cleanRole(value: string): string {
  const cleaned = value
    .replace(/^(?:the|our)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[!.,:;\s-]+$/g, '')
    .trim();
  return /^(?:this|that|the|our|your)$/i.test(cleaned) ? '' : cleaned;
}

function cleanCompany(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[!.,:;\s-]+$/g, '')
    .trim();
}

function firstCapture(
  text: string,
  patterns: RegExp[],
  cleaner: (value: string) => string,
): string {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1];
    if (value) {
      const cleaned = cleaner(value);
      if (cleaned) return cleaned;
    }
  }
  return '';
}

function companyFromAddress(address: string): string {
  const domain = address.trim().toLowerCase().split('@').pop() ?? '';
  if (
    !domain ||
    atsDomains.some((atsDomain) => domain === atsDomain || domain.endsWith(`.${atsDomain}`))
  ) {
    return '';
  }
  const parts = domain.split('.').filter(Boolean);
  const segment =
    parts.length >= 3 &&
    parts.at(-1)?.length === 2 &&
    ['co', 'com', 'org', 'net'].includes(parts.at(-2)!)
      ? parts.at(-3)
      : parts.at(-2);
  if (!segment) return '';
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');
}

function companyFromSender(fromName: string, fromAddress: string): string {
  if (fromName.includes('@'))
    return companyFromAddress(fromName) || companyFromAddress(fromAddress);
  const cleaned = fromName
    .replace(/\s*@\s*(?:icims|workday|greenhouse|lever|ashby)\s*$/i, '')
    .replace(
      /\s+(?:(?:talent|hiring|recruiting|people|careers?|jobs?)\s+team|recruiting|careers?|jobs?|talent)\s*$/i,
      '',
    )
    .trim();
  return cleaned || companyFromAddress(fromAddress);
}

function extractCompanyAndRole(
  subject: string,
  fromName: string,
  fromAddress: string,
  text: string,
): { companyName: string; role: string } {
  const structuredSubject =
    subject.match(/applying to\s+(.+?)\s+at\s+(.+?)(?:[!.]|$)/i) ??
    subject.match(/application for\s+(.+?)\s+(?:at|with)\s+(.+?)(?:[!.]|$)/i);

  const role = structuredSubject?.[1]
    ? cleanRole(structuredSubject[1])
    : firstCapture(
        text,
        [
          /(?:thank you|thanks) for applying (?:for|to)\s+(?:the\s+|our\s+)?(.+?)\s+(?:role|position|opportunity)(?=\s+(?:at|with)\b|[!.]|$)/i,
          /\bapply(?:ing)? for\s+(?:the\s+|our\s+)?(.+?)\s+(?:role|position|opportunity)(?=\s+(?:at|with)\b|[!.]|$)/i,
          /(?:received|receive) your application for\s+(?:the\s+|our\s+)?(.+?)\s+(?:role|position|opportunity)(?=[!.]|$)/i,
          /your application for\s+(?:the\s+|our\s+)?(.+?)\s+(?:role|position|opportunity)(?=[!.]|$)/i,
          /application (?:has been )?received for\s+(?:the\s+)?(.+?)\s+(?:role|position|opportunity)(?=\s+(?:at|with)\b|[!.]|$)/i,
          /showing interest in\s+(?:the\s+|our\s+)?(.+?)\s+(?:role|position|opportunity)(?=\s+(?:at|with)\b|[!.]|$)/i,
          /application received for\s+(.+?)(?=\s+-\s+|[!|]|$)/i,
        ],
        cleanRole,
      ) || 'New application';

  const companyName = structuredSubject?.[2]
    ? cleanCompany(structuredSubject[2])
    : firstCapture(
        text,
        [
          /(?:role|position|opportunity)\s+(?:at|with)\s+(.+?)(?=[!.]|\s+(?:we|your|our)\b|$)/i,
          /\bworking for\s+(.+?)(?=\s+and\b|[!.]|$)/i,
          /\b(?:your )?interest in\s+(.+?)(?=[!.]|$)/i,
          /\bfuture with\s+(.+?)(?=[!.]|$)/i,
          /\bAt\s+([A-Z][A-Za-z0-9&.' -]+?)(?=,)/,
        ],
        cleanCompany,
      ) ||
      firstCapture(
        subject,
        [/(?:thank you|thanks) for applying (?:to|at)\s+(.+?)(?=[!.]|$)/i],
        cleanCompany,
      ) ||
      companyFromSender(fromName, fromAddress) ||
      'Unknown company';

  return { role, companyName };
}

function firstUrl(content: string): string | undefined {
  return content.match(/https?:\/\/[^\s"')<>]+/)?.[0];
}

function rejectionReason(text: string, phrase: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const sentences = normalized.match(/[^.!?]+[.!?]?/g) ?? [normalized];
  return (
    sentences.find((sentence) => sentence.toLowerCase().includes(phrase))?.trim() ??
    `Rejection detected from email phrase: ${phrase}`
  ).slice(0, 500);
}

export function parseRejectionEmail(message: GraphMessage): RejectionEmailCandidate | null {
  const subject = message.subject ?? '';
  const fromName = message.from?.emailAddress?.name ?? '';
  const fromAddress = message.from?.emailAddress?.address ?? '';
  const text = originalTextOf(message);
  const lowered = text.toLowerCase();
  const phrase = rejectionPhrases.find((candidate) => lowered.includes(candidate));
  if (!phrase) return null;

  const extracted = extractCompanyAndRole(subject, fromName, fromAddress, text);
  const subjectCompany = firstCapture(
    subject,
    [/^(.+?)\s*[-:|]\s*(?:your\s+)?application\s+(?:update|status)/i],
    cleanCompany,
  );

  return {
    messageId: message.id,
    ...(message.internetMessageId ? { internetMessageId: message.internetMessageId } : {}),
    subject,
    fromName,
    fromAddress,
    receivedAt: message.receivedDateTime,
    ...(message.webLink ? { webLink: message.webLink } : {}),
    bodyPreview: message.bodyPreview ?? '',
    reason: rejectionReason(text, phrase),
    extracted: {
      companyName: subjectCompany || extracted.companyName,
      role: extracted.role,
    },
  };
}

export function parseApplicationEmail(message: GraphMessage): UnsignedImportCandidate | null {
  const subject = message.subject ?? '';
  const fromName = message.from?.emailAddress?.name ?? '';
  const fromAddress = message.from?.emailAddress?.address ?? '';
  const originalText = originalTextOf(message);
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

  const extracted = extractCompanyAndRole(subject, fromName, fromAddress, originalText);
  if (extracted.role !== 'New application') reasons.push('role extracted from email');
  if (extracted.companyName !== 'Unknown company') reasons.push('company extracted from email');
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
