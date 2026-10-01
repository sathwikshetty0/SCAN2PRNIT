'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';
import { PrintJob } from '@/types/print-job';
import { createClient } from '@/lib/supabase/client';

interface PrinterStatus {
  is_online: boolean;
  error_type: string | null;
  error_message: string | null;
  printer_name: string | null;
}

/* ─── Rich state card ──────────────────────────────────────── */
type StatusJob = Pick<
  PrintJob,
  | 'id'
  | 'job_status'
  | 'payment_status'
  | 'error_message'
  | 'page_count'
  | 'copies'
  | 'estimated_sheets_printed'
  | 'print_progress_known'
>;

function StatusCard({ job }: { job: StatusJob }) {
  const status = job.job_status;
  const payment = job.payment_status;

  if (status === 'QUEUED' && payment === 'PAID') {
    return (
      <div style={{
        borderRadius: 16, padding: '32px 28px', textAlign: 'center',
        background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
        border: '2px solid #F59E0B',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>
          <SpinnerIcon color="#D97706" />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
          Payment confirmed — your document is queued
        </h2>
        <p style={{ color: '#78350F', fontSize: '0.9rem' }}>
          The printer will pick up your job shortly. Please wait.
        </p>
        <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#FEF9C3', borderRadius: 8, padding: '6px 14px' }}>
          <span style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>Job ID: {job.id.slice(0, 8)}…</span>
        </div>
      </div>
    );
  }

  if (status === 'QUEUED' && payment === 'PENDING') {
    return (
      <div style={{
        borderRadius: 16, padding: '32px 28px', textAlign: 'center',
        background: '#F9FAFB', border: '2px solid #D1D5DB',
      }}>
        <div style={{ marginBottom: 12 }}>
          <SpinnerIcon color="#6B7280" />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          Awaiting payment confirmation
        </h2>
        <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>
          Your payment is being verified. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  if (status === 'PRINTING') {
    return (
      <div style={{
        borderRadius: 16, padding: '32px 28px', textAlign: 'center',
        background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
        border: '2px solid #3B82F6',
      }}>
        <div style={{ marginBottom: 12 }}>
          <PrintingIcon />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1D4ED8', marginBottom: 8 }}>
          Printing your document now…
        </h2>
        <p style={{ color: '#1E40AF', fontSize: '0.9rem' }}>
          Please stand by — your pages are being printed.
        </p>
        {job.print_progress_known && (
          <p style={{ color: '#1E40AF', fontSize: '0.8rem', marginTop: 8 }}>
            Approximately {job.estimated_sheets_printed ?? 0} of {job.page_count * job.copies} sheets printed
          </p>
        )}
        <ProgressDots />
      </div>
    );
  }

  if (status === 'PRINTED') {
    return (
      <div style={{
        borderRadius: 16, padding: '36px 28px', textAlign: 'center',
        background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
        border: '3px solid #22C55E',
        boxShadow: '0 4px 24px rgba(34,197,94,0.2)',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: 8 }}>✅</div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803D', marginBottom: 12 }}>
          Ready for collection!
        </h2>
        <p style={{ color: '#166534', fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.5 }}>
          Please collect your document from the printer now.
        </p>
        <div style={{
          marginTop: 20, background: '#BBF7D0', borderRadius: 12,
          padding: '14px 20px', display: 'inline-block',
        }}>
          <span style={{ fontSize: '0.85rem', color: '#14532D', fontWeight: 700 }}>
            🖨️ Your printout is ready at the printer tray
          </span>
        </div>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div style={{
        borderRadius: 16, padding: '32px 28px', textAlign: 'center',
        background: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
        border: '2px solid #EF4444',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>❌</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#B91C1C', marginBottom: 8 }}>
          Print failed
        </h2>
        {job.error_message && (
          <p style={{
            color: '#991B1B', fontSize: '0.875rem',
            background: '#FEE2E2', borderRadius: 8,
            padding: '10px 16px', marginTop: 12, wordBreak: 'break-word',
          }}>
            {job.error_message}
          </p>
        )}
        {job.print_progress_known && (
          <p style={{ color: '#991B1B', fontSize: '0.8rem', marginTop: 10 }}>
            Approximately {job.estimated_sheets_printed ?? 0} of {job.page_count * job.copies} sheets were printed.
          </p>
        )}
        <p style={{ color: '#6B7280', fontSize: '0.8rem', marginTop: 16 }}>
          Please contact the shopkeeper for assistance.
        </p>
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
      Status: {status}
    </div>
  );
}

/* ─── Small helpers ──────────────────────────────────────── */
function SpinnerIcon({ color = '#4F46E5' }: { color?: string }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      border: `4px solid ${color}33`,
      borderTopColor: color,
      animation: 'spin 1s linear infinite',
      margin: '0 auto',
    }} />
  );
}

function PrintingIcon() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
        <polyline points="6 9 6 2 18 2 18 9"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>
    </div>
  );
}

function ProgressDots() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: '#3B82F6',
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function StatusPage() {
  const params = useParams();
  const jobId = (params?.id as string) || '';

  const [job,     setJob]     = useState<StatusJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);

  const supabaseRef = useRef(createClient());

  const fetchJobStatus = async () => {
    try {
      const response = await fetch(`/api/print-status/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not load print status');
      setJob(body.job as StatusJob);
      setPrinterStatus(body.printerStatus as PrinterStatus | null);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error fetching status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    fetchJobStatus();

    // Printer errors are public health state; job details stay behind the status endpoint.
    const channel = supabaseRef.current
      .channel(`job-status-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'printer_status',
          filter: 'id=eq.00000000-0000-0000-0000-000000000001',
        },
        (payload) => {
          if (payload.new) setPrinterStatus(payload.new as PrinterStatus);
        },
      )
      .subscribe();

    const interval = setInterval(fetchJobStatus, 3_000);

    return () => {
      supabaseRef.current.removeChannel(channel);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:.4; } }
        @keyframes bounce  { 0%,80%,100% { transform:scale(0); } 40% { transform:scale(1); } }
      `}</style>

      <div>
        <StepIndicator currentStep={4} />

        <div className="card">
          <h1 className="page-title" style={{ textAlign: 'center', marginBottom: 4 }}>Print Status</h1>
          <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>
            Updates in real-time
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '4px solid #E0E7FF', borderTopColor: '#4F46E5',
                animation: 'spin 1s linear infinite', margin: '0 auto 12px',
              }} />
              <p className="loading-text">Checking job status…</p>
            </div>
          ) : error ? (
            <div className="alert-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          ) : job ? (
            <>
              <StatusCard job={job} />
              {job.job_status !== 'PRINTED' && job.job_status !== 'FAILED'
                && printerStatus && (!printerStatus.is_online || printerStatus.error_type) && (
                <div
                  role="alert"
                  aria-live="assertive"
                  style={{
                    marginTop: 16, borderRadius: 12, padding: 16,
                    color: '#9A3412', background: '#FFF7ED', border: '1px solid #FDBA74',
                  }}
                >
                  <strong>{printerStatus.error_message ?? 'Printer issue detected'}</strong>
                  <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    Your job is not marked ready for collection. Please wait while the printer issue is resolved.
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
