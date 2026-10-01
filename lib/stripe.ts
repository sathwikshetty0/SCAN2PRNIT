/**
 * Stripe SDK initialisation module — SERVER ONLY.
 *
 * This file MUST NOT be imported from any client-side code (components, pages
 * rendered in the browser, or any module that does not run exclusively on the
 * server).  Doing so would expose STRIPE_SECRET_KEY to the browser.
 *
 * Requirements: 13.3
 */

import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    'Missing required server environment variable: STRIPE_SECRET_KEY. ' +
      'Set it in your .env.local file or Vercel project settings.',
  );
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-06-30.basil',
  typescript: true,
});
