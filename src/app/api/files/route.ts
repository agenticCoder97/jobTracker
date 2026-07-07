import { NextResponse } from 'next/server';

import {
  removeStoredFile,
  signedUrlFor,
  uploadStoredFile,
} from '@/lib/repositories/supabase/files-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SCOPE_PREFIXES = {
  attachment: 'attachments',
  resume: 'documents/resumes',
  'cover-letter': 'documents/cover-letters',
} as const;
type Scope = keyof typeof SCOPE_PREFIXES;
type UploadFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function adapterDisabled() {
  return NextResponse.json(
    { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
    { status: 501 },
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-100);
  return cleaned || 'file';
}

function isValidPath(path: string): boolean {
  return (
    (path.startsWith('attachments/') || path.startsWith('documents/')) && !path.includes('..')
  );
}

function isUploadFile(value: unknown): value is UploadFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'size' in value &&
    'arrayBuffer' in value &&
    typeof (value as Partial<UploadFile>).name === 'string' &&
    typeof (value as Partial<UploadFile>).size === 'number' &&
    typeof (value as Partial<UploadFile>).arrayBuffer === 'function'
  );
}

export async function POST(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const scope = form?.get('scope');
  const applicationId = form?.get('applicationId');
  if (!isUploadFile(file) || typeof scope !== 'string' || !(scope in SCOPE_PREFIXES)) {
    return NextResponse.json({ error: 'invalid body: expected file and scope' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file too large (max 10 MB)' }, { status: 400 });
  }
  const prefix =
    scope === 'attachment' && typeof applicationId === 'string' && applicationId.length > 0
      ? `${SCOPE_PREFIXES.attachment}/${sanitizeName(applicationId)}`
      : SCOPE_PREFIXES[scope as Scope];
  const path = `${prefix}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;
  try {
    await uploadStoredFile(path, await file.arrayBuffer(), file.type || 'application/octet-stream');
    return NextResponse.json({ path, name: file.name, size: file.size });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function GET(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const path = new URL(request.url).searchParams.get('path');
  if (!path || !isValidPath(path)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  try {
    return NextResponse.json({ url: await signedUrlFor(path) });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const path = new URL(request.url).searchParams.get('path');
  if (!path || !isValidPath(path)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  try {
    await removeStoredFile(path);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}
