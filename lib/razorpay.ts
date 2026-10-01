/**
 * Razorpay SDK initialisation module — SERVER ONLY.
 *
 * This file MUST NOT be imported from any client-side code.
 * Doing so would expose RAZORPAY_KEY_SECRET to the browser.
 */

import Razorpay from 'razorpay';

const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn('Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables are missing.');
}

export const razorpay = new Razorpay({
  key_id: keyId || 'placeholder_key_id',
  key_secret: keySecret || 'placeholder_key_secret',
});
