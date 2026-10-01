import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay sends a webhook with the event payload.
 * We verify the signature using RAZORPAY_WEBHOOK_SECRET,
 * then on payment.captured update the job to PAID.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Verify Razorpay webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  if (expectedSignature !== signature) {
    console.error('Razorpay webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Handle payment captured event
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const jobId = payment?.notes?.jobId;

    if (jobId) {
      const supabase = createServerClient();
      const { error } = await supabase
        .from('print_jobs')
        .update({ payment_status: 'PAID' })
        .eq('id', jobId);

      if (error) {
        console.error(`Failed to update payment_status for job ${jobId}:`, error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
      console.log(`Successfully updated payment_status for job ${jobId} to PAID`);
    } else {
      console.warn('payment.captured event received but no jobId in notes');
    }
  }

  return NextResponse.json({ received: true });
}
