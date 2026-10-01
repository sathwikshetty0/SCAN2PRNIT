/**
 * FileUploadZone — drag-and-drop / click-to-select PDF upload component.
 *
 * Behaviour:
 * 1. Accepts only `application/pdf` files (enforced via `accept` attribute and
 *    client-side MIME + size validation).
 * 2. Validates:
 *    - MIME type must be `application/pdf`  → "Only PDF files are supported."
 *    - File size must be ≤ 20 MB (20,971,520 bytes) → "File size must not exceed 20 MB."
 * 3. On a valid file:
 *    a. Calls `getPdfPageCount` to extract the page count (defaults to 1 on failure).
 *    b. POSTs `{ fileName, fileSize, pageCount }` to `/api/create-job`.
 *    c. PUTs the raw file bytes to the `uploadUrl` returned by the API.
 *    d. Calls `onSuccess` with `{ jobId, pageCount }` so the parent can redirect.
 * 4. Shows a loading spinner during all async operations.
 * 5. All interactive areas are ≥ 44×44 CSS pixels (touch-friendly).
 *
 * @requirements 2.1 — provide a file upload interface that accepts PDF files only
 * @requirements 2.2 — validate that the file type is `application/pdf`
 * @requirements 2.3 — validate that the file size does not exceed 20 MB
 * @requirements 2.4 — display "Only PDF files are supported." on invalid type
 * @requirements 2.5 — display "File size must not exceed 20 MB." on size exceeded
 * @requirements 2.7 — store the file in Supabase Storage via signed upload URL
 * @requirements 14.4 — touch-friendly controls, interactive elements ≥ 44×44 CSS px
 * @requirements 14.5 — display loading states during all asynchronous operations
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { getPdfPageCount } from '@/lib/pdf-page-count';
import { sanitizeFilename } from '@/lib/filename';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum permitted file size in bytes (20 MiB). */
export const MAX_FILE_SIZE_BYTES = 20_971_520;

/** The only MIME type accepted. */
export const ACCEPTED_MIME_TYPE = 'application/pdf';

/** Validation error messages — exact strings from Requirements 2.4 and 2.5. */
export const ERROR_INVALID_TYPE = 'Only PDF files are supported.';
export const ERROR_FILE_TOO_LARGE = 'File size must not exceed 20 MB.';

// ---------------------------------------------------------------------------
// Validation helper (exported so it can be imported by the property test)
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Validates a file candidate against the MIME-type and size rules.
 *
 * @param mimeType - The `type` property of the `File` or a simulated MIME string.
 * @param size     - The `size` property of the `File` in bytes.
 * @returns        A `ValidationResult` with `valid: true` when both checks pass.
 */
export function validateFile(mimeType: string, size: number): ValidationResult {
  if (mimeType !== ACCEPTED_MIME_TYPE) {
    return { valid: false, error: ERROR_INVALID_TYPE };
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: ERROR_FILE_TOO_LARGE };
  }
  return { valid: true, error: null };
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface FileUploadZoneProps {
  /**
   * Called after the file has been uploaded to Supabase Storage and a
   * Print_Job record has been created. The parent page uses these values
   * to redirect to `/options?job_id=<id>&page_count=<n>`.
   */
  onSuccess: (result: { jobId: string; pageCount: number }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FileUploadZone({ onSuccess }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // -------------------------------------------------------------------------
  // Core upload flow
  // -------------------------------------------------------------------------

  const handleFile = useCallback(
    async (file: File) => {
      // Clear any previous error
      setError(null);

      // 1. Client-side validation
      const validation = validateFile(file.type, file.size);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      setLoading(true);

      try {
        // 2. Extract page count via pdfjs-dist (null → fall back to 1)
        setLoadingMessage('Reading PDF…');
        const rawPageCount = await getPdfPageCount(file);
        const pageCount = rawPageCount ?? 1;

        // 3. POST to /api/create-job
        setLoadingMessage('Creating print job…');
        const sanitizedName = sanitizeFilename(file.name);

        const createJobRes = await fetch('/api/create-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: sanitizedName,
            fileSize: file.size,
            pageCount,
          }),
        });

        if (!createJobRes.ok) {
          const body = await createJobRes.json().catch(() => ({}));
          throw new Error(
            (body as { message?: string }).message ||
              'Unable to start print job. Please try again.',
          );
        }

        const { jobId, uploadUrl } = (await createJobRes.json()) as {
          jobId: string;
          uploadUrl: string;
          uploadPath: string;
        };

        // 4. PUT the raw file to the signed upload URL
        setLoadingMessage('Uploading file…');
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': ACCEPTED_MIME_TYPE },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed. Please try again.');
        }

        // 5. Notify parent — triggers navigation to /options
        onSuccess({ jobId, pageCount });
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMessage('');
      }
    },
    [onSuccess],
  );

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset value so re-selecting the same file triggers onChange
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleZoneClick = () => {
    if (!loading) {
      inputRef.current?.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !loading) {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPE}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
        disabled={loading}
      />

      {/* Drop zone / click target */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload PDF file — click or drag and drop"
        aria-disabled={loading}
        onClick={handleZoneClick}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          // Base layout
          'relative flex flex-col items-center justify-center',
          'min-h-[180px] w-full rounded-2xl border-2 border-dashed',
          'px-6 py-10 text-center transition-colors duration-200',
          // Touch target: the whole zone is well above 44×44 px
          'cursor-pointer select-none',
          // State-dependent colours
          loading
            ? 'border-indigo-300 bg-indigo-50 cursor-not-allowed'
            : isDragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50',
        ].join(' ')}
      >
        {loading ? (
          /* Loading state */
          <div className="flex flex-col items-center gap-3" aria-live="polite">
            {/* Spinner */}
            <svg
              className="h-10 w-10 animate-spin text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-medium text-indigo-700">
              {loadingMessage || 'Processing…'}
            </p>
          </div>
        ) : (
          /* Idle / drag-active state */
          <>
            {/* Upload icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className={[
                'mb-3 h-12 w-12',
                isDragging ? 'text-indigo-500' : 'text-gray-400',
              ].join(' ')}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>

            <p className="text-sm font-medium text-gray-700">
              <span className="text-indigo-600 underline underline-offset-2">
                Choose a PDF
              </span>{' '}
              or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-500">PDF only · max 20 MB</p>
          </>
        )}
      </div>

      {/* Validation / upload error message */}
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-3 text-sm font-medium text-red-600"
        >
          {error}
        </p>
      )}

      {/* Explicit "Select file" button for touch users who prefer a button */}
      {!loading && (
        <button
          type="button"
          onClick={handleZoneClick}
          className={[
            'mt-4 w-full rounded-xl bg-indigo-600 px-6 py-3',
            // Minimum 44 px height enforced by py-3 + text + border
            'min-h-[44px]',
            'text-sm font-semibold text-white shadow-sm',
            'hover:bg-indigo-500 active:bg-indigo-700',
            'focus-visible:outline focus-visible:outline-2',
            'focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
            'transition-colors duration-150',
          ].join(' ')}
        >
          Select PDF file
        </button>
      )}
    </div>
  );
}
