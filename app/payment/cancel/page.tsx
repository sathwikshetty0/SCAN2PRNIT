'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('job_id');

  return (
    <div className="card text-center" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
        boxShadow: '0 8px 20px rgb(239 68 68 / .2)',
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true" style={{ color: '#991B1B' }}>
          <path d="M11 11l14 14M25 11L11 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>

      <h1 className="page-title" style={{ marginBottom: 8 }}>Payment Cancelled</h1>
      <p className="page-subtitle" style={{ marginBottom: 24 }}>
        No charge was made. You can try again whenever you are ready.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {jobId && (
          <button
            className="btn-primary"
            onClick={() => router.push(`/options?job_id=${jobId}`)}
          >
            Try Payment Again →
          </button>
        )}
        <button className="btn-secondary" onClick={() => router.push('/')}>
          Start Over
        </button>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="card text-center" style={{ padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}>
      <CancelContent />
    </Suspense>
  );
}
