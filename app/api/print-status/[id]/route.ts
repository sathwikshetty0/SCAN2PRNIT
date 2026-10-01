import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) {
    return NextResponse.json({ error: 'Print job not found' }, { status: 404 });
  }

  try {
    const supabase = createServerClient();
    const [{ data: job, error: jobError }, { data: printerStatus, error: printerError }] = await Promise.all([
      supabase
        .from('print_jobs')
        .select('id, payment_status, job_status, error_message, page_count, copies, estimated_sheets_printed, print_progress_known')
        .eq('id', params.id)
        .maybeSingle(),
      supabase
        .from('printer_status')
        .select('is_online, error_type, error_message, printer_name')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle(),
    ]);

    if (jobError) throw jobError;
    if (printerError) throw printerError;
    if (!job) return NextResponse.json({ error: 'Print job not found' }, { status: 404 });

    return NextResponse.json(
      { job, printerStatus },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[print-status] lookup failed:', error);
    return NextResponse.json({ error: 'Could not load print status' }, { status: 500 });
  }
}
