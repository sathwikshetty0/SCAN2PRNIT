import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase/server';

type InventoryRpcResult = { remaining_sheets: number; low_alert: boolean }[];

async function sendLowPaperAlert(remainingSheets: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Telegram credentials are not configured');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Scan2Print paper alert: approximately ${remainingSheets} sheets remain. Please refill the tray.`,
    }),
  });
  if (!response.ok) throw new Error(`Telegram returned HTTP ${response.status}`);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { data, error } = await createServerClient()
    .from('paper_inventory')
    .select('remaining_sheets, updated_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[admin/paper-inventory] read failed:', error);
    return NextResponse.json({ error: 'Could not read paper inventory' }, { status: 500 });
  }

  return NextResponse.json({ inventory: data });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: { mode?: unknown; sheets?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { mode, sheets } = body;
  if (!['initial', 'refill', 'waste'].includes(String(mode))
    || !Number.isSafeInteger(sheets) || Number(sheets) < 1 || Number(sheets) > 10000) {
    return NextResponse.json({ error: 'Choose an inventory action and enter 1–10,000 sheets' }, { status: 400 });
  }

  const supabase = createServerClient();
  const rpc = mode === 'waste'
    ? await supabase.rpc('record_wasted_paper', { p_sheets: Number(sheets) })
    : await supabase.rpc('refill_paper_inventory', {
      p_sheets: Number(sheets),
      p_initial: mode === 'initial',
    });

  if (rpc.error) {
    console.error('[admin/paper-inventory] update failed:', rpc.error);
    return NextResponse.json({ error: 'Could not update paper inventory' }, { status: 500 });
  }

  const result = (rpc.data as InventoryRpcResult | null)?.[0];
  if (!result) {
    return NextResponse.json({ error: 'Inventory update returned no result' }, { status: 500 });
  }

  if (result.low_alert) {
    try {
      await sendLowPaperAlert(result.remaining_sheets);
    } catch (error) {
      console.error('[admin/paper-inventory] low-paper Telegram alert failed:', error);
      return NextResponse.json({
        inventory: { remaining_sheets: result.remaining_sheets },
        warning: 'Inventory updated, but Telegram alert could not be sent',
      }, { status: 502 });
    }
  }

  return NextResponse.json({ inventory: { remaining_sheets: result.remaining_sheets } });
}
