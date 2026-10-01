'use client';

import React, { useCallback, useRef, useState } from 'react';
import { getPdfPageCount } from '@/lib/pdf-page-count';
import { sanitizeFilename } from '@/lib/filename';

export const MAX_FILE_SIZE_BYTES  = 20_971_520;
export const ACCEPTED_MIME_TYPE   = 'application/pdf';
export const ERROR_INVALID_TYPE   = 'Only PDF files are supported.';
export const ERROR_FILE_TOO_LARGE = 'File size must not exceed 20 MB.';

export interface ValidationResult { valid: boolean; error: string | null; }

export function validateFile(mimeType: string, size: number): ValidationResult {
  if (mimeType !== ACCEPTED_MIME_TYPE) return { valid: false, error: ERROR_INVALID_TYPE };
  if (size > MAX_FILE_SIZE_BYTES)       return { valid: false, error: ERROR_FILE_TOO_LARGE };
  return { valid: true, error: null };
}

export interface FileUploadZoneProps {
  onSuccess: (result: { jobId: string; pageCount: number }) => void;
}

export default function FileUploadZone({ onSuccess }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging,      setIsDragging]      = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [loadingMessage,  setLoadingMessage]  = useState('');

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const validation = validateFile(file.type, file.size);
    if (!validation.valid) { setError(validation.error); return; }

    setLoading(true);
    try {
      setLoadingMessage('Reading PDF…');
      const rawPageCount = await getPdfPageCount(file);
      const pageCount = rawPageCount ?? 1;

      setLoadingMessage('Creating print job…');
      const sanitizedName = sanitizeFilename(file.name);
      const createJobRes = await fetch('/api/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: sanitizedName, fileSize: file.size, pageCount }),
      });

      if (!createJobRes.ok) {
        const body = await createJobRes.json().catch(() => ({}));
        throw new Error((body as any).message || 'Unable to start print job. Please try again.');
      }

      const { jobId, uploadUrl } = await createJobRes.json() as { jobId: string; uploadUrl: string; uploadPath: string };

      setLoadingMessage('Uploading file…');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': ACCEPTED_MIME_TYPE },
        body: file,
      });

      if (!uploadRes.ok) throw new Error('Upload failed. Please try again.');

      onSuccess({ jobId, pageCount });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [onSuccess]);

  const handleInputChange  = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop      = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
  const handleDragOver  = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleZoneClick = () => { if (!loading) inputRef.current?.click(); };
  const handleKeyDown   = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !loading) { e.preventDefault(); inputRef.current?.click(); }
  };

  const zoneClass = [
    'upload-zone',
    loading ? 'loading' : isDragging ? 'dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <div style={{ width: '100%' }}>
      <input ref={inputRef} type="file" accept={ACCEPTED_MIME_TYPE}
        className="sr-only" aria-hidden="true" tabIndex={-1}
        onChange={handleInputChange} disabled={loading}
      />

      {/* Drop zone */}
      <div
        role="button" tabIndex={0}
        aria-label="Upload PDF — click or drag and drop"
        aria-disabled={loading}
        className={zoneClass}
        onClick={handleZoneClick}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {loading ? (
          <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="spinner" />
            <p className="loading-text">{loadingMessage || 'Processing…'}</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 19.5v2A1.5 1.5 0 0 0 5.5 23h17a1.5 1.5 0 0 0 1.5-1.5v-2M14 3v14M9.5 7.5 14 3l4.5 4.5"
                />
              </svg>
            </div>
            <p className="upload-title">
              <span className="upload-sub"><span>Choose a PDF</span> or drag and drop</span>
            </p>
            <p className="upload-sub" style={{ marginTop: 4 }}>PDF only · max 20 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="alert-error" style={{ marginTop: 12 }} role="alert" aria-live="assertive">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      {!loading && (
        <button
          id="select-pdf-btn"
          type="button"
          onClick={handleZoneClick}
          className="btn-primary"
          style={{ marginTop: 14 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 2v10M4.5 6.5 9 2l4.5 4.5"/>
            <path strokeLinecap="round" d="M2 14h14"/>
          </svg>
          Select PDF file
        </button>
      )}
    </div>
  );
}
