import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Webhook Error: Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const jobId = session.metadata?.jobId;

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
      console.warn('Received checkout.session.completed event but no jobId found in metadata');
    }
  }

  return NextResponse.json({ received: true });
}
