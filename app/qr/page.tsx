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
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col items-center gap-6 text-center mt-8">
      <h1 className="text-2xl font-bold text-gray-900">Scan to Print</h1>
      <p className="text-sm text-gray-600 max-w-xs">
        Scan this QR code with your mobile camera to open the document upload page.
      </p>

      {uploadUrl ? (
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-inner">
          <QRCodeSVG value={uploadUrl} size={220} />
        </div>
      ) : (
        <div className="w-[220px] h-[220px] bg-gray-100 animate-pulse rounded-xl" />
      )}

      <div className="flex flex-col gap-1 items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Direct URL</span>
        <a
          href={uploadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 font-mono text-sm underline hover:text-indigo-800 break-all"
        >
          {uploadUrl}
        </a>
      </div>
    </div>
  );
}
