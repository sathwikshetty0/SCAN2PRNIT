import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    if (typeof body.paused !== 'boolean') {
      return NextResponse.json({ error: 'paused must be a boolean' }, { status: 400 });
    }

    const { error } = await createServerClient().from('kiosk_settings').upsert({
      id: '00000000-0000-0000-0000-000000000001',
      is_paused: body.paused,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/kiosk-pause] update failed:', error);
    return NextResponse.json({ error: 'Could not update kiosk state' }, { status: 500 });
  }
}
