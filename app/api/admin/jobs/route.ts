import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Fetch all print jobs (last 100)
    const { data: jobs, error: jobsError } = await supabase
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (jobsError) throw jobsError;

    // Fetch printer status — tolerate table-not-found gracefully
    let printerStatus = null;
    try {
      const { data: printerRows, error: printerError } = await supabase
        .from('printer_status')
        .select('*')
        .limit(1);
      if (!printerError) {
        printerStatus = printerRows?.[0] ?? null;
      }
    } catch {
      // printer_status table may not exist yet — dashboard shows "unknown"
    }

    // Fetch kiosk paused state
    let kioskPaused = false;
    try {
      const { data: ks } = await supabase
        .from('kiosk_settings')
        .select('is_paused')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      kioskPaused = ks?.is_paused ?? false;
    } catch {}

    // Compute stats
    const paid = jobs?.filter(j => j.payment_status === 'PAID') ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const todayJobs = paid.filter(j => j.created_at.startsWith(today));

    const stats = {
      totalRevenue:    paid.reduce((s, j) => s + (j.total_price ?? 0), 0),
      todayRevenue:    todayJobs.reduce((s, j) => s + (j.total_price ?? 0), 0),
      totalJobs:       paid.length,
      todayJobs:       todayJobs.length,
      totalPages:      paid.reduce((s, j) => s + (j.page_count ?? 0) * (j.copies ?? 1), 0),
      failedJobs:      jobs?.filter(j => j.job_status === 'FAILED').length ?? 0,
      printingJobs:    jobs?.filter(j => j.job_status === 'PRINTING').length ?? 0,
    };

    return NextResponse.json({ jobs, printerStatus, stats, kioskPaused });
  } catch (err: any) {
    console.error('[admin/jobs] error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error', details: err?.details ?? null },
      { status: 500 },
    );
  }
}
