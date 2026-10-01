import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * POST /api/verify-payment
 *
 * Called from the client after Razorpay modal payment success.
 * Verifies the payment signature and updates the job to PAID.
 */
export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, jobId } =
      await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !jobId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error(`Payment signature mismatch for job ${jobId}`);
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // Update job to PAID
    const supabase = createServerClient();
    const { error } = await supabase
      .from('print_jobs')
      .update({ payment_status: 'PAID' })
      .eq('id', jobId);

    if (error) {
      console.error(`Failed to update payment_status for job ${jobId}:`, error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    console.log(`Payment verified and job ${jobId} marked as PAID`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
