import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

export type ImportConfidence = 'high' | 'medium' | 'low';

export type ExtractedApplicationFields = {
  companyName: string;
  role: string;
  source: string;
  applied: string;
  postingUrl?: string | undefined;
  location?: string | undefined;
  description?: string | undefined;
};

export type UnsignedImportCandidate = {
  messageId: string;
  internetMessageId?: string | undefined;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
  webLink?: string | undefined;
  bodyPreview: string;
  confidence: ImportConfidence;
  score: number;
  reasons: string[];
  extracted: ExtractedApplicationFields;
};

export type SignedImportCandidate = {
  payload: UnsignedImportCandidate;
  signature: string;
};

type StableJsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | StableJsonValue[]
  | { [key: string]: StableJsonValue };

function stableStringify(value: StableJsonValue): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);

  return `{${entries.join(',')}}`;
}

function signatureFor(payload: UnsignedImportCandidate, secret: string): string {
  return createHmac('sha256', secret)
    .update(stableStringify(payload as StableJsonValue))
    .digest('base64url');
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, 'base64url');
  const expectedBytes = Buffer.from(expected, 'base64url');

  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function signImportCandidate(
  payload: UnsignedImportCandidate,
  secret: string,
): SignedImportCandidate {
  return {
    payload,
    signature: signatureFor(payload, secret),
  };
}

export function verifyImportCandidate(
  signed: SignedImportCandidate,
  secret: string,
): UnsignedImportCandidate {
  const expected = signatureFor(signed.payload, secret);

  if (!signaturesMatch(signed.signature, expected)) {
    throw new Error('Invalid import candidate signature');
  }

  return signed.payload;
}
