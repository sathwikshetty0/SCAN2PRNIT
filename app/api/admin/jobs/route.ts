import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = createServerClient();

    const [{ data: jobs, error: jobsError }, { data: printerStatus, error: printerError },
      { data: kioskSettings, error: settingsError }, { data: paperInventory, error: inventoryError }] = await Promise.all([
      supabase
        .from('print_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('printer_status')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle(),
      supabase
        .from('kiosk_settings')
        .select('is_paused')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle(),
      supabase
        .from('paper_inventory')
        .select('remaining_sheets, updated_at')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    if (jobsError) throw jobsError;
    if (printerError) throw printerError;
    if (settingsError) throw settingsError;
    if (inventoryError) throw inventoryError;

    // Compute stats
    const paid = jobs?.filter(j => j.payment_status === 'PAID') ?? [];
    const printed = paid.filter(j => j.job_status === 'PRINTED');
    const today = new Date().toISOString().slice(0, 10);
    const todayJobs = paid.filter(j => j.created_at.startsWith(today));

    const stats = {
      totalRevenue:    paid.reduce((s, j) => s + (j.total_price ?? 0), 0),
      todayRevenue:    todayJobs.reduce((s, j) => s + (j.total_price ?? 0), 0),
      totalJobs:       paid.length,
      todayJobs:       todayJobs.length,
      totalPages:      printed.reduce((s, j) => s + (j.page_count ?? 0) * (j.copies ?? 1), 0),
      failedJobs:      jobs?.filter(j => j.job_status === 'FAILED').length ?? 0,
      printingJobs:    jobs?.filter(j => j.job_status === 'PRINTING').length ?? 0,
    };

    return NextResponse.json({
      jobs,
      printerStatus,
      paperInventory,
      stats,
      kioskPaused: kioskSettings?.is_paused ?? false,
    });
  } catch (err: any) {
    console.error('[admin/jobs] error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error', details: err?.details ?? null },
      { status: 500 },
    );
  }
}
