import { NextResponse } from 'next/server';

/**
 * This route is kept for backwards compatibility only.
 * Stripe has been replaced by Razorpay.
 * Real webhook is at /api/webhooks/razorpay
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Stripe is no longer used. Use /api/webhooks/razorpay instead.' },
    { status: 410 }, // 410 Gone
  );
}
