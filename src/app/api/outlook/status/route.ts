import { NextResponse } from 'next/server';

import { getOutlookConnection } from '@/lib/repositories/supabase/outlook-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const connection = await getOutlookConnection();
    return NextResponse.json({ connected: Boolean(connection), email: connection?.email ?? null });
  } catch {
    // A status probe degrades to "not connected" rather than erroring the UI.
    return NextResponse.json({ connected: false, email: null });
  }
}
