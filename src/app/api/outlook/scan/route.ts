import { NextResponse } from 'next/server';

import { scanOutlookApplications } from '@/lib/outlook/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await scanOutlookApplications();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
