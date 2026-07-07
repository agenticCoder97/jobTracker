/**
 * Manual research-run trigger — TEMPLATE.
 *
 * Same engine as the cron route, but admin-gated so an operator can refresh
 * on demand from the UI or curl. Keeps logic shared via a single call into
 * the cron handler once the implementation lands in phase 2.
 */

import { NextResponse } from 'next/server';

import { assertRole, AuthorizationError } from '@/lib/rbac/policies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await assertRole('admin');
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden', required: error.required }, { status: 403 });
    }
    throw error;
  }

  // TODO(phase 2): share execution logic with /api/cron/research/route.ts.
  return NextResponse.json({
    ok: true,
    note: 'template only — admin-gated trigger compiles but is a no-op',
  });
}
