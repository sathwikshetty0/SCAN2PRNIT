'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';
import FileUploadZone from '@/components/FileUploadZone';

export default function UploadPage() {
  const router = useRouter();

  const handleSuccess = ({ jobId, pageCount }: { jobId: string; pageCount: number }) => {
    router.push(`/options?job_id=${encodeURIComponent(jobId)}&page_count=${pageCount}`);
  };

  return (
    <div>
      <StepIndicator currentStep={1} />

      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
            borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 14px rgb(79 70 229 / .15)',
          }}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <path d="M5 22l4-4 4 4M15 18V8" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 8h2a6 6 0 0 1 0 12H7" stroke="#818CF8" strokeWidth="2" strokeLinecap="round"/>
              <path d="M19 8h2a6 6 0 0 1 0 12h-2" stroke="#818CF8" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="page-title">Print Your Document</h1>
          <p className="page-subtitle">Upload a PDF · Choose options · Pay & Print</p>
        </div>

        <FileUploadZone onSuccess={handleSuccess} />

        <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: '⚡', text: 'Fast printing' },
            { icon: '🔒', text: 'Secure upload' },
            { icon: '📄', text: 'A4 · PDF only · Max 20 MB' },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 500,
            }}>
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
