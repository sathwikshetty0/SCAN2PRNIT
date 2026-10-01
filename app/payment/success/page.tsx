'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('job_id');

  return (
    <div className="card text-center" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="success-icon">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <path d="M8 18l7 7 13-13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h1 className="page-title" style={{ marginBottom: 8 }}>Payment Successful!</h1>
      <p className="page-subtitle" style={{ marginBottom: 24 }}>
        Your payment was confirmed. Your document is queued for printing.
      </p>

      {jobId && (
        <div style={{
          background: 'var(--gray-50)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: '0.8rem',
          color: 'var(--gray-500)',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>Job ID:</span>{' '}
          <span style={{ fontFamily: 'monospace' }}>{jobId}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {jobId && (
          <button
            className="btn-primary"
            onClick={() => router.push(`/status?job_id=${jobId}`)}
          >
            Track Print Status →
          </button>
        )}
        <button className="btn-secondary" onClick={() => router.push('/')}>
          Print Another Document
        </button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="card text-center" style={{ padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
