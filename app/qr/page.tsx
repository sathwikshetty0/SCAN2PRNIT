'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRPage() {
  const [uploadUrl, setUploadUrl] = useState<string>('');

  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    setUploadUrl(siteUrl);
  }, []);

  return (
    <div className="card" style={{ textAlign: 'center', marginTop: 16 }}>
      <div style={{
        width: 64, height: 64,
        background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
        borderRadius: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth={1.8} aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <path strokeLinecap="round" d="M14 14h2m3 0v2m0 3h-3v-3m3 3v2"/>
        </svg>
      </div>

      <h1 className="page-title" style={{ marginBottom: 8 }}>Scan to Print</h1>
      <p className="page-subtitle" style={{ marginBottom: 28, maxWidth: 280, margin: '0 auto 28px' }}>
        Point your phone camera at this QR code to open the upload page.
      </p>

      {uploadUrl ? (
        <div style={{
          display: 'inline-block',
          padding: 16,
          background: 'white',
          borderRadius: 16,
          border: '1px solid var(--gray-200)',
          boxShadow: '0 4px 16px rgb(0 0 0 / .08)',
          marginBottom: 24,
        }}>
          <QRCodeSVG
            value={uploadUrl}
            size={220}
            fgColor="#312E81"
            level="H"
          />
        </div>
      ) : (
        <div style={{
          width: 252, height: 252,
          background: 'var(--gray-100)',
          borderRadius: 16,
          margin: '0 auto 24px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}

      <div>
        <div style={{
          fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6,
        }}>
          Direct URL
        </div>
        <a
          href={uploadUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--indigo-600)',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            wordBreak: 'break-all',
            textDecoration: 'underline',
          }}
        >
          {uploadUrl}
        </a>
      </div>
    </div>
  );
}
