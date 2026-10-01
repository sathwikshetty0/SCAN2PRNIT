import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { razorpay } from '@/lib/razorpay';

export async function POST(request: Request) {
  try {
    const { jobId, copies, orientation, colourMode, totalPrice } = await request.json();

    if (!jobId || !copies || !orientation || !colourMode || totalPrice === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Update print_options and total_price on Print_Job
    const { error: updateError } = await supabase
      .from('print_jobs')
      .update({
        copies,
        print_options: { orientation, colourMode },
        total_price: totalPrice,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update print job:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Convert totalPrice to smallest currency unit (e.g. Paise for INR: 1 INR = 100 paise)
    const amountInSubunits = Math.round(totalPrice * 100);
    const currency = process.env.NEXT_PUBLIC_CURRENCY || 'INR';

    // Create Razorpay Order
    const options = {
      amount: amountInSubunits,
      currency: currency.toUpperCase(),
      receipt: `receipt_${jobId.slice(0, 12)}`,
      notes: {
        jobId,
      },
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      throw new Error('Failed to create Razorpay Order');
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      jobId,
    });
  } catch (error: any) {
    console.error('Create Razorpay checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
