# Implementation Plan: A4 Print Kiosk

## Overview

Implementation follows the three-subsystem architecture: Next.js web app (Vercel), Supabase backend, and Python print controller. Tasks are ordered so each step integrates with the previous ones — no orphaned code. The web app and print controller communicate exclusively through Supabase state.

## Tasks

- [x] 1. Project scaffolding and environment setup
  - Initialise Next.js 14 project with TypeScript and Tailwind CSS using `create-next-app`
  - Install dependencies: `@supabase/supabase-js`, `stripe`, `pdfjs-dist`, `fast-check`, `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `ts-jest`
  - Configure `tsconfig.json`, `tailwind.config.ts`, and `jest.config.ts`
  - Create `/print-controller` directory and initialise `requirements.txt` with `supabase`, `pypdf`, `hypothesis`, `pytest`, `python-dotenv`
  - Create `.env.example` at project root listing all required environment variables from the design without values
  - _Requirements: 13.5, 15.3_

- [x] 2. TypeScript types and core library utilities
  - [x] 2.1 Define shared TypeScript types
    - Create `types/print-job.ts` with `PaymentStatus`, `JobStatus`, `PrintJob` interface, `JOB_STATUS_LABELS`, and `PAYMENT_STATUS_LABELS` exactly as specified in the design
    - _Requirements: 7.1, 6.3_

  - [x] 2.2 Implement filename sanitisation
    - Create `lib/filename.ts` with `sanitizeFilename(raw: string): string` — strips `.pdf`, replaces spaces with underscores, removes non-alphanumeric/hyphen/underscore characters, slices to 100 chars, falls back to `"document"`, appends `.pdf`
    - _Requirements: 2.6_

  - [x] 2.3 Write property test for filename sanitisation
    - Create `lib/__tests__/filename.property.test.ts`
    - Use `fc.string()` arbitrary; run minimum 100 iterations
    - Assert output matches `/^[a-zA-Z0-9_-]{1,100}\.pdf$/`
    - Assert base name ≤ 100 characters
    - **Property 1: Filename sanitisation produces valid, bounded output**
    - **Validates: Requirements 2.6**

  - [x] 2.4 Implement pricing logic
    - Create `lib/pricing.ts` with `KioskConfig` interface and `calculatePrice(config, pageCount, copies, colourMode)` returning `{ perPagePrice, total }`
    - Read `NEXT_PUBLIC_BW_PRICE_PER_PAGE`, `NEXT_PUBLIC_COLOUR_SURCHARGE`, `NEXT_PUBLIC_CURRENCY` from env
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 2.5 Write property tests for pricing logic
    - Create `lib/__tests__/pricing.property.test.ts`
    - **Property 3**: Use `fc.record({ pageCount: fc.integer({min:1}), copies: fc.integer({min:1,max:99}), price: fc.float({min:0.01}) })` — assert `total === perPagePrice * pageCount * copies`; minimum 100 iterations
    - **Property 4**: Use arbitrary `KioskConfig` with non-negative surcharge — assert colour `perPagePrice >= bwPricePerPage`; minimum 100 iterations
    - **Property 3: Price formula is exact linear multiplication**
    - **Property 4: Colour surcharge is always non-negative**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 2.6 Implement client-side PDF page count utility
    - Create `lib/pdf-page-count.ts` with `getPdfPageCount(file: File): Promise<number | null>` using dynamic import of `pdfjs-dist`; return `null` on any error
    - _Requirements: 4.5_

  - [x] 2.7 Write unit tests for pricing and PDF page count utilities
    - Create `lib/__tests__/pricing.test.ts`: test specific B&W and colour calculations, boundary copies values (1, 99)
    - Create `lib/__tests__/pdf-page-count.test.ts`: mock `pdfjs-dist`, test returned page count; test `null` on rejection
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 3. Supabase client setup
  - [x] 3.1 Create browser Supabase client
    - Create `lib/supabase/client.ts` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - _Requirements: 13.1_

  - [x] 3.2 Create server Supabase client
    - Create `lib/supabase/server.ts` using `SUPABASE_SERVICE_ROLE_KEY` (server-only, no `NEXT_PUBLIC_` prefix)
    - _Requirements: 13.2, 9.4_

  - [x] 3.3 Create Stripe SDK initialisation module
    - Create `lib/stripe.ts` initialising Stripe with `STRIPE_SECRET_KEY` (server-only)
    - _Requirements: 13.3_

- [x] 4. Supabase database schema, storage bucket, and RLS
  - [x] 4.1 Write SQL migration for print_jobs table
    - Create `supabase/migrations/001_print_jobs.sql`
    - Define `print_jobs` table with all columns, defaults, and CHECK constraints for `payment_status`, `job_status`, `copies`, `total_price`, and `page_count` as specified in the design data model
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Write RLS policies
    - Append to migration: `ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY`
    - `anon_insert` policy: INSERT for anon WITH CHECK `(payment_status = 'PENDING' AND job_status = 'QUEUED')`
    - `anon_select` policy: SELECT for anon USING `(true)`
    - No UPDATE/DELETE policy for anon — service_role bypasses RLS
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 4.3 Configure Supabase Storage bucket
    - Create `supabase/seed.sql` or migration step: create `print-files` bucket with private access
    - Document file path convention `jobs/{job_id}/{sanitized_filename}.pdf` in code comment
    - _Requirements: 9.1, 9.2_

- [x] 5. Next.js API routes
  - [x] 5.1 Implement POST /api/create-job route
    - Create `app/api/create-job/route.ts`
    - Accept `{ fileName, fileSize, pageCount }` from request body
    - Use server Supabase client to: (1) generate signed upload URL (2-hour expiry) for `jobs/{uuid}/{sanitizedFilename}`, (2) insert `print_jobs` row with `payment_status=PENDING`, `job_status=QUEUED`, `total_price=0` (placeholder until options chosen)
    - If DB insert fails, attempt rollback deletion of the signed upload path; return 500
    - Return `{ jobId, uploadUrl, uploadPath }` on success
    - _Requirements: 2.7, 2.8, 2.9, 9.2_

  - [x] 5.2 Implement POST /api/create-checkout route
    - Create `app/api/create-checkout/route.ts`
    - Accept `{ jobId, copies, orientation, colourMode, totalPrice }` from request body
    - Update `print_options` JSONB and `total_price` on the Print_Job using Service_Role_Key
    - Create Stripe Checkout Session with `totalPrice` (converted to smallest currency unit), `jobId` in metadata, success and cancel URLs pointing to `/payment/success?job_id=` and `/payment/cancel`
    - Return `{ checkoutUrl }`
    - _Requirements: 5.1, 5.2, 3.6_

  - [x] 5.3 Implement POST /api/webhooks/stripe route
    - Create `app/api/webhooks/stripe/route.ts`
    - Read raw request body (disable body parsing for this route)
    - Verify Stripe webhook signature using `STRIPE_WEBHOOK_SECRET`
    - On `checkout.session.completed`: update `payment_status = PAID` via Service_Role_Key using job ID from session metadata
    - On signature failure: log and return 400
    - On any other event type: return 200
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

  - [x] 5.4 Implement GET /api/signed-url route
    - Create `app/api/signed-url/route.ts`
    - Accept `jobId` query param; look up `file_path` from `print_jobs`; generate signed download URL (60-minute expiry) using Service_Role_Key
    - Return `{ signedUrl }` or 404/500 as appropriate
    - _Requirements: 9.2_

- [x] 6. Checkpoint — API routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. UI components
  - [x] 7.1 Implement StepIndicator component
    - Create `components/StepIndicator.tsx` displaying 4 steps: Upload → Options → Payment → Status
    - Accept `currentStep: 1 | 2 | 3 | 4` prop; highlight active step
    - Use touch-friendly sizing (min 44×44px interactive areas), single-column mobile layout
    - _Requirements: 14.3, 14.4_

  - [x] 7.2 Implement FileUploadZone component
    - Create `components/FileUploadZone.tsx`
    - Accept PDF files only (`accept="application/pdf"`); validate MIME type and file size (≤ 20 MB) client-side
    - Display "Only PDF files are supported." or "File size must not exceed 20 MB." on validation failure
    - Show loading state during upload; call `getPdfPageCount` before submitting
    - On valid file, POST to `/api/create-job`, then upload file to Supabase Storage using the returned signed URL
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 7.3 Write property test for file validation logic
    - Create `components/__tests__/FileUploadZone.property.test.ts`
    - Extract the validation predicate; use `fc.record({ mimeType: fc.string(), size: fc.nat() })`; run minimum 100 iterations
    - Assert: accepted if and only if `mimeType === 'application/pdf' && size <= 20_971_520`
    - **Property 2: File validation rejects invalid type or size**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 7.4 Implement PrintOptionsForm component
    - Create `components/PrintOptionsForm.tsx`
    - Controls: copies (integer input, 1–99), orientation radio (Portrait/Landscape), colour mode radio (Black & White/Colour)
    - On any change, invoke `calculatePrice` and propagate updated price to parent within 300 ms
    - Serialise selected options as `{ orientation, colourMode }` JSON
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.5 Implement PriceSummary component
    - Create `components/PriceSummary.tsx`
    - Display per-page price, page count, copies, and total — all formatted to exactly two decimal places with currency symbol
    - _Requirements: 4.3, 4.4_

  - [x] 7.6 Write property test for PriceSummary rendering
    - Create `components/__tests__/PriceSummary.property.test.ts`
    - Use `fc.record({ copies: fc.integer({min:1,max:99}), pageCount: fc.integer({min:1}), colourMode: fc.constantFrom('bw','colour') })`; render component; minimum 100 iterations
    - Assert per-page price, page count, copies count, and total are all present and match `/\d+\.\d{2}/`
    - **Property 5: Price summary display always contains all required fields**
    - **Validates: Requirements 3.5, 4.3, 4.4**

  - [x] 7.7 Implement StatusDisplay component
    - Create `components/StatusDisplay.tsx`
    - Accept `PrintJob` prop; render human-readable labels from `JOB_STATUS_LABELS` and `PAYMENT_STATUS_LABELS`
    - Display `error_message` when `job_status === 'FAILED'`
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 7.8 Write property test for status label coverage
    - Create `components/__tests__/StatusDisplay.property.test.ts`
    - Use `fc.constantFrom(...Object.keys(JOB_STATUS_LABELS))` and `fc.constantFrom(...Object.keys(PAYMENT_STATUS_LABELS))`; minimum 100 iterations
    - Assert rendered output contains a non-empty string label for every combination (no `undefined`, no empty string, no raw enum key)
    - **Property 7: Status screen displays non-empty labels for all status values**
    - **Validates: Requirements 6.2, 6.3**

- [x] 8. Next.js pages
  - [x] 8.1 Implement Upload page
    - Create `app/page.tsx`; render `<StepIndicator currentStep={1} />` and `<FileUploadZone />`
    - On successful job creation redirect to `/options?job_id=<id>&page_count=<n>`
    - Responsive single-column layout (Tailwind); loading state during async operations
    - _Requirements: 1.2, 1.3, 14.1, 14.2, 14.5_

  - [x] 8.2 Implement Options page
    - Create `app/options/page.tsx`; render `<StepIndicator currentStep={2} />`, `<PrintOptionsForm />`, and `<PriceSummary />`
    - Read `job_id` and `page_count` from URL search params
    - Display filename and file size retrieved from Supabase (by job ID) for confirmation
    - "Proceed to Payment" button: POST to `/api/create-checkout`, redirect to returned `checkoutUrl`
    - _Requirements: 3.1, 3.2, 3.5, 5.1, 5.2, 14.1_

  - [x] 8.3 Implement Payment Success and Cancel pages
    - Create `app/payment/success/page.tsx`: display job ID and estimated wait time; render `<StepIndicator currentStep={3} />`; link to `/status/<job_id>`
    - Create `app/payment/cancel/page.tsx`: display cancellation message; link back to `/options?job_id=<id>`
    - _Requirements: 5.7, 5.8_

  - [x] 8.4 Implement Status page with polling
    - Create `app/status/[id]/page.tsx`; render `<StepIndicator currentStep={4} />` and `<StatusDisplay />`
    - Poll Supabase for job status every 10 seconds using `useEffect` + `setInterval`; clear interval on unmount
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 8.5 Write property and serialisation tests
    - Create `lib/__tests__/print-options.property.test.ts`
    - Use `fc.record({ orientation: fc.constantFrom('portrait','landscape'), colourMode: fc.constantFrom('bw','colour') })`; minimum 100 iterations
    - Serialise with `JSON.stringify`, deserialise with `JSON.parse`; assert deep equality
    - **Property 6: Print options serialisation round-trip is lossless**
    - **Validates: Requirements 3.6**

- [x] 9. Checkpoint — Web app complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. RLS integration property test
  - [x] 10.1 Set up test Supabase client with anon key
    - Create `lib/__tests__/rls.property.test.ts`
    - Configure a dedicated test Supabase project (or local Supabase dev) with anon key in test env
    - _Requirements: 8.4, 5.6_

  - [x] 10.2 Write RLS escalation property test
    - Insert a `print_jobs` row via service role; then attempt UPDATE `payment_status = 'PAID'` using anon key
    - Run minimum 100 iterations with `fc.uuid()` generated job IDs
    - Assert every UPDATE attempt is rejected (Supabase returns error / row unchanged on re-read)
    - **Property 8: RLS anon key cannot escalate payment status to PAID**
    - **Validates: Requirements 5.6, 8.4**

- [x] 11. QR code display page
  - Create `app/qr/page.tsx` that renders a QR code encoding the Web_App's upload URL (`/`) using an appropriate QR library (e.g. `qrcode.react`)
  - Display the URL in plain text below the QR code for accessibility
  - _Requirements: 1.1_

- [x] 12. Python print controller — config and logging
  - [x] 12.1 Implement config.py
    - Create `print-controller/config.py` with `Config` dataclass and `load_config()` function
    - Load `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PRINTER_NAME` (required), `POLL_INTERVAL_SECONDS` (optional, default 10, range 5–300) from `.env` via `python-dotenv`
    - Call `sys.exit(1)` with a descriptive message for each missing required variable
    - _Requirements: 10.1, 13.4, 13.6, 15.4_

  - [x] 12.2 Implement logger.py
    - Create `print-controller/logger.py` with structured logging setup writing to both stdout and a rotating file (`print_controller.log`, 5 MB × 3 backups)
    - Include timestamp, job_id, and event description in every log entry
    - _Requirements: 12.2_

  - [x] 12.3 Write unit tests for config.py
    - Create `print-controller/tests/test_config.py`
    - Test that `load_config` raises `SystemExit` on each missing required variable independently (3 separate tests)
    - _Requirements: 13.6_

- [x] 13. Python print controller — validator and printer
  - [x] 13.1 Implement validator.py
    - Create `print-controller/validator.py` with `is_valid_pdf(path: Path) -> bool`
    - Return `True` iff first 4 bytes equal `b'%PDF'` (bytes `0x25 0x50 0x44 0x46`); return `False` on empty file or any IOError
    - _Requirements: 12.5, 12.6_

  - [x] 13.2 Write property test for PDF validation
    - Create `print-controller/tests/test_validator_property.py`
    - Use `@given(st.binary())` from Hypothesis; set `settings(max_examples=100)`
    - Assert `is_valid_pdf` returns `True` iff sequence starts with `b'%PDF'`; also cover empty bytes and partial `b'%PD'`
    - Comment: `# Feature: a4-print-kiosk, Property 9: PDF magic byte validation is correct for all byte sequences`
    - **Property 9: PDF magic byte validation is correct for all byte sequences**
    - **Validates: Requirements 12.5, 12.6**

  - [x] 13.3 Implement printer.py
    - Create `print-controller/printer.py` with `print_file(file_path, printer_name, copies)` and custom `PrintError`
    - Linux/macOS: `lp -d {printer_name} -n {copies} {file_path}`
    - Windows: `SumatraPDF.exe -print-to "{printer_name}" -print-settings "{copies}x" "{file_path}"`
    - Raise `PrintError` on non-zero subprocess exit code or subprocess exception; do NOT fall back to system default printer
    - _Requirements: 11.2, 11.3, 11.7_

  - [x] 13.4 Write unit tests for validator and printer
    - Create `print-controller/tests/test_validator.py`: test valid `%PDF` header, non-PDF bytes, empty file, partial `%PD` — expect `False`
    - Create `print-controller/tests/test_printer.py`: mock `subprocess.run`; verify correct command built for Linux, macOS, Windows; verify `PrintError` raised on non-zero exit
    - _Requirements: 11.2, 12.5, 12.6_

- [x] 14. Python print controller — poller and downloader
  - [x] 14.1 Implement poller.py
    - Create `print-controller/poller.py` with `claim_next_job(supabase: Client) -> dict | None`
    - Atomic `UPDATE ... SET job_status='PRINTING' WHERE payment_status='PAID' AND job_status='QUEUED' RETURNING *`; return `None` if 0 rows returned
    - Raise network exceptions to caller (caller logs and skips cycle)
    - _Requirements: 10.2, 10.3, 10.4, 10.5_

  - [x] 14.2 Implement downloader.py
    - Create `print-controller/downloader.py` with `download_file(supabase, file_path, dest_dir) -> Path` and `DownloadError`
    - Retry up to 3 times with exponential backoff: 5 s → 10 s → 20 s
    - Raise `DownloadError` after exhausting retries
    - _Requirements: 11.1, 12.4_

  - [x] 14.3 Write unit tests for poller and downloader
    - Create `print-controller/tests/test_poller.py`: mock Supabase client; test `None` returned when 0 rows; test claimed job dict returned on success
    - Create `print-controller/tests/test_downloader.py`: mock Supabase client to fail then succeed; assert retry count; assert `DownloadError` raised after 3 failures; verify backoff sleep calls
    - _Requirements: 10.4, 12.4_

- [x] 15. Python print controller — updater and main loop
  - [x] 15.1 Implement updater.py
    - Create `print-controller/updater.py` with functions: `mark_printing(supabase, job_id)`, `mark_printed(supabase, job_id)`, `mark_failed(supabase, job_id, error_message)`
    - `mark_printed` sets `job_status='PRINTED'` and `printed_at=utcnow()`
    - `mark_failed` sets `job_status='FAILED'` and populates `error_message`
    - _Requirements: 10.3, 11.4, 11.5_

  - [x] 15.2 Implement main.py
    - Create `print-controller/main.py` with `run_one_cycle`, `run_forever`, and `recover_stale_jobs` (marks any PRINTING jobs → FAILED with `"Controller restarted"` on startup)
    - `run_forever` wraps `run_one_cycle` in `while True` with `try/except Exception` → log + continue; sleeps `config.poll_interval` between cycles
    - Each cycle: claim job → skip if `None` → download → validate → print → update status → delete temp file
    - Delete temp file in `finally` block (runs regardless of success or failure)
    - Log each polling cycle result per Requirement 10.5
    - _Requirements: 10.2, 10.3, 11.1, 11.4, 11.5, 11.6, 12.1, 12.3, 15.1, 15.2_

  - [x] 15.3 Create print-controller/.env.example and requirements.txt
    - `.env.example`: `SUPABASE_URL=`, `SUPABASE_SERVICE_ROLE_KEY=`, `PRINTER_NAME=`, `POLL_INTERVAL_SECONDS=10`
    - `requirements.txt`: pin versions for `supabase`, `pypdf`, `hypothesis`, `pytest`, `python-dotenv`
    - _Requirements: 13.4, 13.5_

- [x] 16. Checkpoint — Print controller complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. End-to-end integration test
  - [x] 17.1 Write Playwright integration tests
    - Create `e2e/print-flow.spec.ts`
    - Test full upload → options → payment success flow against test Supabase and Stripe test mode
    - Test mobile viewport (375px): no horizontal scroll, all interactive elements ≥ 44×44 px, step indicator shows correct active step at each page
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 17.2 Write print controller integration test
    - Create `print-controller/tests/test_integration.py`
    - Insert PAID+QUEUED job into test Supabase → start controller for one cycle → assert job becomes PRINTED
    - Insert a PRINTING job → run `recover_stale_jobs` → assert job becomes FAILED with `"Controller restarted"`
    - _Requirements: 10.3, 10.4, 12.1_

- [x] 18. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- All 9 correctness properties from the design are covered by property-based test sub-tasks
- Property tests use `fast-check` (TypeScript) and `Hypothesis` (Python), minimum 100 iterations each
- All property test files carry a comment tag referencing the design property number and description
- `service_role` bypasses RLS by default in Supabase — no explicit UPDATE policy for anon is the security control
- The print controller temp file deletion is in a `finally` block to guarantee cleanup

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1", "3.2", "3.3", "4.1"] },
    { "id": 1, "tasks": ["2.2", "2.4", "2.6", "4.2", "4.3"] },
    { "id": 2, "tasks": ["2.3", "2.5", "2.7", "7.1", "12.1", "12.2"] },
    { "id": 3, "tasks": ["7.2", "7.4", "7.5", "7.7", "12.3", "13.1", "13.3"] },
    { "id": 4, "tasks": ["7.3", "7.6", "7.8", "8.5", "13.2", "13.4", "14.1", "14.2"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "5.4", "14.3", "15.1"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4", "15.2", "15.3"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2", "17.1", "17.2"] }
  ]
}
```
