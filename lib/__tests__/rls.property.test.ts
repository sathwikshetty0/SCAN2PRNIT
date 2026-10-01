// Feature: a4-print-kiosk, Property 8: RLS anon key cannot escalate payment status to PAID

import * as fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

/**
 * Validates: Requirements 5.6, 8.4
 *
 * Property 8: RLS anon key cannot escalate payment status to PAID
 *
 * For any existing print_jobs row, an UPDATE operation targeting
 * payment_status = 'PAID' issued with the Anon_Key SHALL be rejected
 * by the RLS policy, leaving the row unchanged.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

describe('Property 8: RLS anon key cannot escalate payment status to PAID', () => {
  it('rejects UPDATE payment_status = "PAID" when executed with anon key', async () => {
    // Skip if running without live Supabase env
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
      console.warn('Skipping RLS live property test: Supabase environment variables not set.');
      return;
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const anonClient = createClient(supabaseUrl, anonKey);

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (jobId) => {
        // Insert row via service role
        const { error: insertError } = await serviceClient.from('print_jobs').insert({
          id: jobId,
          file_name: 'test.pdf',
          file_path: `jobs/${jobId}/test.pdf`,
          page_count: 1,
          copies: 1,
          payment_status: 'PENDING',
          job_status: 'QUEUED',
          total_price: 0.05,
        });

        if (insertError) {
          throw new Error(`Service insert failed: ${insertError.message}`);
        }

        try {
          // Attempt UPDATE via anon client
          const { error: updateError } = await anonClient
            .from('print_jobs')
            .update({ payment_status: 'PAID' })
            .eq('id', jobId);

          // Verify row was NOT updated to PAID
          const { data: fetchRow } = await serviceClient
            .from('print_jobs')
            .select('payment_status')
            .eq('id', jobId)
            .single();

          expect(fetchRow?.payment_status).toBe('PENDING');
        } finally {
          // Cleanup
          await serviceClient.from('print_jobs').delete().eq('id', jobId);
        }
      }),
      { numRuns: 10 } // reduced for live DB integration
    );
  });
});
