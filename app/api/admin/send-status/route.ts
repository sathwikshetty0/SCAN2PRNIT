import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

async function sendTelegram(token: string, chatId: string, text: string): Promise<string | null> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const result: unknown = await res.json().catch(() => null);
    if (res.ok && typeof result === 'object' && result !== null && 'ok' in result && result.ok === true) {
      return null;
    }

    const description = typeof result === 'object' && result !== null && 'description' in result
      && typeof result.description === 'string'
      ? result.description.slice(0, 300)
      : `HTTP ${res.status}`;
    return `Telegram API rejected the message: ${description}`;
  } catch {
    return 'Could not reach the Telegram API';
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]!));
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in environment' },
      { status: 500 },
    );
  }

  try {
    const supabase = createServerClient();

    const { data: jobs, error: jobsError } = await supabase
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (jobsError) throw jobsError;

    const { data: printerRows, error: printerError } = await supabase
      .from('printer_status')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();
    if (printerError) throw printerError;

    const paid       = jobs.filter(j => j.payment_status === 'PAID');
    const today      = new Date().toISOString().slice(0, 10);
    const todayPaid  = paid.filter(j => j.created_at.startsWith(today));
    const printing   = jobs.filter(j => j.job_status === 'PRINTING');
    const queued     = jobs.filter(j => j.job_status === 'QUEUED' && j.payment_status === 'PAID');
    const failed     = jobs.filter(j => j.job_status === 'FAILED');
    const todayFailed = failed.filter(j => j.created_at.startsWith(today));

    const totalRev   = paid.reduce((s, j) => s + (j.total_price ?? 0), 0);
    const todayRev   = todayPaid.reduce((s, j) => s + (j.total_price ?? 0), 0);
    const totalPages = paid.reduce((s, j) => s + (j.page_count ?? 0) * (j.copies ?? 1), 0);

    const printerLine = printerRows
      ? printerRows.is_online && !printerRows.error_type
        ? `✅ Ready — ${printerRows.printer_name}`
        : `⚠️ ${printerRows.error_message ?? printerRows.error_type} — ${printerRows.printer_name}`
      : '❓ Unknown (controller not running)';

    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    const message = [
      `📊 <b>Scan2Print — Status Report</b>`,
      `<i>${now}</i>`,
      ``,
      `🖨️ <b>Printer:</b> ${escapeHtml(printerLine)}`,
      ``,
      `<b>Today</b>`,
      `  💰 Revenue: ₹${todayRev.toFixed(2)}`,
      `  📄 Jobs: ${todayPaid.length}`,
      `  ❌ Failed: ${todayFailed.length}`,
      ``,
      `<b>All Time</b>`,
      `  💰 Revenue: ₹${totalRev.toFixed(2)}`,
      `  📄 Jobs: ${paid.length}`,
      `  📃 Pages: ${totalPages}`,
      ``,
      `<b>Live Queue</b>`,
      `  🔄 Printing now: ${printing.length}`,
      `  ⏳ Queued (paid): ${queued.length}`,
      `  ❌ Failed total: ${failed.length}`,
    ].join('\n');

    const telegramError = await sendTelegram(token, chatId, message);
    if (telegramError) {
      return NextResponse.json({ error: telegramError }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
