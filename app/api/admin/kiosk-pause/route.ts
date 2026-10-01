import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { paused } = await request.json();
  const supabase = createServerClient();
  await supabase.from('kiosk_settings').upsert({
    id: '00000000-0000-0000-0000-000000000001',
    is_paused: paused,
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
