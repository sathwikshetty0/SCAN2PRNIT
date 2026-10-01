/**
 * @jest-environment jsdom
 */

// Feature: a4-print-kiosk, Property 7: Status screen displays non-empty labels for all status values

import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import React from 'react';
import StatusDisplay from '../StatusDisplay';
import {
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PrintJob,
} from '../../types/print-job';

/**
 * Validates: Requirements 6.2, 6.3
 *
 * Property 7: For any valid PrintJob with any combination of job_status and
 * payment_status, the rendered StatusDisplay SHALL display a non-empty
 * human-readable label for each status field. No status value SHALL map to
 * `undefined`, an empty string, or a raw enum key (e.g. "QUEUED", "PENDING").
 */

const RAW_JOB_KEYS = Object.keys(JOB_STATUS_LABELS);
const RAW_PAYMENT_KEYS = Object.keys(PAYMENT_STATUS_LABELS);

/** Builds a minimal valid PrintJob for a given status combination. */
function makeJob(
  jobStatus: PrintJob['job_status'],
  paymentStatus: PrintJob['payment_status'],
): PrintJob {
  return {
    id: 'test-id',
    file_name: 'test.pdf',
    file_path: 'jobs/test-id/test.pdf',
    copies: 1,
    print_options: { orientation: 'portrait', colourMode: 'bw' },
    payment_status: paymentStatus,
    job_status: jobStatus,
    error_message: jobStatus === 'FAILED' ? 'Something went wrong' : null,
    created_at: new Date().toISOString(),
    printed_at: jobStatus === 'PRINTED' ? new Date().toISOString() : null,
    total_price: 0.1,
    page_count: 1,
  };
}

describe('StatusDisplay — Property 7: non-empty labels for all status values', () => {
  it(
    'renders a non-empty human-readable job status label for every job_status / payment_status combination',
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...(RAW_JOB_KEYS as Array<PrintJob['job_status']>)),
          fc.constantFrom(
            ...(RAW_PAYMENT_KEYS as Array<PrintJob['payment_status']>),
          ),
          (jobStatus, paymentStatus) => {
            const job = makeJob(jobStatus, paymentStatus);
            const { container } = render(React.createElement(StatusDisplay, { job }));
            const text = container.textContent ?? '';

            // The expected human-readable labels
            const expectedJobLabel = JOB_STATUS_LABELS[jobStatus];
            const expectedPaymentLabel = PAYMENT_STATUS_LABELS[paymentStatus];

            // 1. Labels must be non-empty strings
            expect(expectedJobLabel).toBeTruthy();
            expect(expectedPaymentLabel).toBeTruthy();

            // 2. Rendered text must contain the human-readable job label
            expect(text).toContain(expectedJobLabel);

            // 3. Rendered text must contain the human-readable payment label
            expect(text).toContain(expectedPaymentLabel);

            // 4. Raw enum keys must NOT appear as standalone label text in badges
            //    (they may appear elsewhere, e.g. aria attributes, so we check
            //     that the rendered label values are the human-readable ones above)
            //    Specifically: the label for this status must not equal its raw key.
            expect(expectedJobLabel).not.toBe(jobStatus);
            expect(expectedPaymentLabel).not.toBe(paymentStatus);

            // 5. Labels must not be empty strings
            expect(expectedJobLabel.length).toBeGreaterThan(0);
            expect(expectedPaymentLabel.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
