import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

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

    // Convert totalPrice to smallest currency unit (e.g., pence/cents)
    const amountInCents = Math.round(totalPrice * 100);
    const currency = process.env.NEXT_PUBLIC_CURRENCY || 'GBP';

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'A4 Document Print',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        jobId,
      },
      success_url: `${origin}/payment/success?job_id=${jobId}`,
      cancel_url: `${origin}/payment/cancel?job_id=${jobId}`,
    });

    if (!session.url) {
      throw new Error('Failed to create Stripe session URL');
    }

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Create checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
