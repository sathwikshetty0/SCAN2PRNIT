import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('kiosk_settings')
      .select('is_paused')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();
    return NextResponse.json({ is_paused: data?.is_paused ?? false });
  } catch {
    return NextResponse.json({ is_paused: false });
  }
}
