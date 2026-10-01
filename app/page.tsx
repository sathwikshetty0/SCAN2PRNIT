'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';
import FileUploadZone from '@/components/FileUploadZone';

/* ─── Kiosk Pause Overlay ─────────────────────────────────── */
function KioskPausedOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '32px',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: 24 }}>🔧</div>
      <h1 style={{
        fontSize: '1.75rem', fontWeight: 800,
        color: '#111827', marginBottom: 16,
      }}>
        Printer Temporarily Unavailable
      </h1>
      <p style={{
        fontSize: '1.05rem', color: '#4B5563',
        maxWidth: 420, lineHeight: 1.7,
      }}>
        The kiosk is currently offline for maintenance.
        <br />
        Please try again shortly.
      </p>
      <div style={{
        marginTop: 32, padding: '10px 20px',
        background: '#F3F4F6', borderRadius: 10,
        fontSize: '0.8rem', color: '#6B7280',
      }}>
        Checking again automatically…
      </div>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const [kioskPaused, setKioskPaused] = useState(false);
  const [pauseChecked, setPauseChecked] = useState(false);

  const checkKioskStatus = async () => {
    try {
      const res = await fetch('/api/kiosk-status');
      if (res.ok) {
        const data = await res.json();
        setKioskPaused(data.is_paused === true);
      }
    } catch {
      // Network error — assume available
    } finally {
      setPauseChecked(true);
    }
  };

  useEffect(() => {
    checkKioskStatus();
    const interval = setInterval(checkKioskStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleSuccess = ({ jobId, pageCount }: { jobId: string; pageCount: number }) => {
    router.push(`/options?job_id=${encodeURIComponent(jobId)}&page_count=${pageCount}`);
  };

  // Don't flash the page before first check
  if (!pauseChecked) return null;

  if (kioskPaused) return <KioskPausedOverlay />;

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
