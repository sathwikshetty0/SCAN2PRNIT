/**
 * StatusDisplay — renders the current state of a PrintJob in human-readable form.
 *
 * - Displays a labelled badge for `job_status` using `JOB_STATUS_LABELS`.
 * - Displays a labelled badge for `payment_status` using `PAYMENT_STATUS_LABELS`.
 * - When `job_status === 'FAILED'`, shows the `error_message` (falls back to
 *   "An error occurred" if `error_message` is null).
 * - Mobile-first, single-column layout — works from 375 px upward.
 *
 * @requirements 6.2 — display current job_status and payment_status
 * @requirements 6.3 — human-readable labels for every status value
 * @requirements 6.4 — show error_message when job_status is FAILED
 */

import React from 'react';
import {
  PrintJob,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../types/print-job';

interface StatusDisplayProps {
  job: PrintJob;
}

// ─── Visual style maps ────────────────────────────────────────────────────────

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error';

const JOB_STATUS_VARIANT: Record<PrintJob['job_status'], BadgeVariant> = {
  QUEUED:   'neutral',
  PRINTING: 'warning',
  PRINTED:  'success',
  FAILED:   'error',
};

const PAYMENT_STATUS_VARIANT: Record<PrintJob['payment_status'], BadgeVariant> = {
  PENDING: 'neutral',
  PAID:    'success',
  FAILED:  'error',
};

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-gray-100  text-gray-700  border border-gray-200',
  success: 'bg-green-100 text-green-800 border border-green-200',
  warning: 'bg-amber-100 text-amber-800 border border-amber-200',
  error:   'bg-red-100   text-red-800   border border-red-200',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusRowProps {
  label: string;
  value: string;
  variant: BadgeVariant;
}

function StatusRow({ label, value, variant }: StatusRowProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span
        className={[
          'inline-flex items-center rounded-full px-3 py-1',
          'text-sm font-semibold self-start sm:self-auto',
          BADGE_CLASSES[variant],
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * StatusDisplay component.
 *
 * Renders job status, payment status, and — when the job has failed — the
 * associated error message.
 *
 * @param job - The PrintJob to display.
 */
export default function StatusDisplay({ job }: StatusDisplayProps) {
  const jobLabel     = JOB_STATUS_LABELS[job.job_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[job.payment_status];
  const jobVariant   = JOB_STATUS_VARIANT[job.job_status];
  const payVariant   = PAYMENT_STATUS_VARIANT[job.payment_status];

  const isFailed    = job.job_status === 'FAILED';
  const errorMessage = job.error_message ?? 'An error occurred';

  return (
    <section
      aria-label="Print job status"
      className="w-full max-w-md mx-auto flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {/* Status rows */}
      <div className="flex flex-col gap-4">
        <StatusRow
          label="Print status"
          value={jobLabel}
          variant={jobVariant}
        />
        <div className="h-px bg-gray-100" aria-hidden="true" />
        <StatusRow
          label="Payment status"
          value={paymentLabel}
          variant={payVariant}
        />
      </div>

      {/* Error message — only shown when job_status === 'FAILED' */}
      {isFailed && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4"
        >
          {/* Warning icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>

          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-red-800">Print failed</p>
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}
    </section>
  );
}
