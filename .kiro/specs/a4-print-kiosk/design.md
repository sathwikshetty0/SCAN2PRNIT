# Design Document: A4 Print Kiosk

## Overview

The A4 Print Kiosk is a three-subsystem architecture: a Next.js web application (Vercel), a Supabase backend (database + storage), and a Python print controller (local laptop). These subsystems are deliberately decoupled — the web app and print controller communicate exclusively through shared Supabase state, with no direct network calls between them. This decoupling is the key architectural decision that enables the Raspberry Pi upgrade path.

**Technology choices:**
- **Web App**: Next.js 14 (App Router), TypeScript, Tailwind CSS, deployed to Vercel
- **Backend**: Supabase (PostgreSQL, Storage, RLS)
- **Payment**: Stripe Checkout (hosted, server-side session creation + webhook)
- **Print Controller**: Python 3.10+, `supabase-py`, `pypdf`, cross-platform `subprocess` printing
- **PDF page counting (client-side)**: `pdfjs-dist` loaded dynamically in the browser
- **PDF page counting (server-side)**: `pypdf` in the print controller

The system flow is:

1. User scans QR code → opens Next.js upload page
2. User selects PDF → client validates → uploads directly to Supabase Storage via signed upload URL → Next.js API Route creates Print_Job record
3. User chooses options → price calculated client-side → Next.js API Route creates Stripe Checkout Session
4. Stripe redirects user to hosted checkout → user pays → Stripe sends webhook to Next.js API Route
5. Webhook handler verifies signature → updates Print_Job `payment_status = PAID` using Service_Role_Key
6. Print Controller polls Supabase → claims PAID+QUEUED job → downloads file → prints → updates status

---

## Architecture

```mermaid
graph TD
    subgraph User["User (Mobile Browser)"]
        A[Scan QR Code]
    end

    subgraph Vercel["Web App — Next.js on Vercel"]
        B[Upload Page\napp/page.tsx]
        C[Options Page\napp/options/page.tsx]
        D[API: /api/create-job\nPOST]
        E[API: /api/create-checkout\nPOST]
        F[API: /api/webhooks/stripe\nPOST]
        G[Status Page\napp/status/[id]/page.tsx]
    end

    subgraph Supabase["Supabase Backend"]
        H[(print_jobs table\nPostgreSQL + RLS)]
        I[Storage Bucket\nprint-files — private]
    end

    subgraph Stripe["Stripe"]
        J[Hosted Checkout Page]
        K[Webhook Events]
    end

    subgraph PrintController["Print Controller — Python on Laptop"]
        L[Poller Loop]
        M[File Downloader]
        N[PDF Validator]
        O[Print Dispatcher\nsubprocess]
        P[Status Updater]
    end

    subgraph Printer["Hardware"]
        Q[USB A4 Printer]
    end

    A --> B
    B --> D
    D --> I
    D --> H
    C --> E
    E --> J
    J --> K
    K --> F
    F --> H
    G --> H
    L --> H
    L --> M
    M --> I
    M --> N
    N --> O
    O --> Q
    O --> P
    P --> H
```

### Key Architectural Decisions

**Signed upload URLs instead of server-side proxying**: The browser uploads directly to Supabase Storage using a short-lived signed upload URL. This avoids routing 20 MB files through Vercel serverless functions (which have body size limits) and reduces latency. The signed URL is generated server-side and never exposes the Service_Role_Key to the client.

**Stripe Checkout (hosted)**: The Payment_Gateway integration uses Stripe's hosted checkout page rather than Stripe Elements. This minimises PCI scope on the prototype and avoids building a custom payment form.

**Atomic job claiming**: The print controller claims jobs atomically using `UPDATE ... WHERE job_status = 'QUEUED' AND payment_status = 'PAID' RETURNING id`. If zero rows are returned, another instance claimed the job and the current instance skips it silently.

**No Web_App ↔ Print_Controller direct link**: All coordination happens through Supabase rows. This means the laptop's IP address, port, or protocol are irrelevant — swapping to a Raspberry Pi requires only updating environment variables.

---

## Components and Interfaces

### Web Application

#### Directory Structure

```
/
├── app/
│   ├── page.tsx                          # Step 1: Upload
│   ├── options/
│   │   └── page.tsx                      # Step 2: Options + price
│   ├── payment/
│   │   ├── success/page.tsx              # Post-payment success screen
│   │   └── cancel/page.tsx              # Cancelled payment screen
│   ├── status/
│   │   └── [id]/page.tsx                 # Step 4: Job status polling
│   └── api/
│       ├── create-job/route.ts           # Creates Print_Job record + returns signed upload URL
│       ├── create-checkout/route.ts      # Creates Stripe Checkout Session
│       └── webhooks/stripe/route.ts      # Stripe webhook handler
├── components/
│   ├── StepIndicator.tsx
│   ├── FileUploadZone.tsx
│   ├── PrintOptionsForm.tsx
│   ├── PriceSummary.tsx
│   └── StatusDisplay.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client (anon key)
│   │   └── server.ts                     # Server Supabase client (service role key)
│   ├── stripe.ts                         # Stripe SDK initialisation
│   ├── pricing.ts                        # Pure price calculation logic
│   ├── filename.ts                       # Filename sanitisation logic
│   └── pdf-page-count.ts                # Client-side pdfjs-dist page counting
└── types/
    └── print-job.ts                      # Shared TypeScript types
```

#### API Route Contracts

**POST /api/create-job**

Request body:
```json
{
  "fileName": "my_document.pdf",
  "fileSize": 1048576,
  "pageCount": 5
}
```
Response (success 200):
```json
{
  "jobId": "uuid-v4",
  "uploadUrl": "https://...",
  "uploadPath": "jobs/uuid-v4/my_document.pdf"
}
```
Behaviour: Generates a signed upload URL via Service_Role_Key, inserts `print_jobs` row with `payment_status=PENDING`, `job_status=QUEUED`. If DB insert fails, returns 500 (no orphaned upload since the signed URL was never used).

**POST /api/create-checkout**

Request body:
```json
{
  "jobId": "uuid-v4",
  "copies": 2,
  "orientation": "portrait",
  "colourMode": "bw",
  "totalPrice": 1.20
}
```
Response (success 200):
```json
{ "checkoutUrl": "https://checkout.stripe.com/..." }
```
Behaviour: Updates `print_options` JSONB on the Print_Job, then creates a Stripe Checkout Session with the total amount. The `jobId` is embedded in the session `metadata` for use in the webhook handler.

**POST /api/webhooks/stripe**

Headers required: `stripe-signature`

The route handler must read the **raw request body** (not parsed JSON) for Stripe signature verification. In Next.js App Router this requires setting `export const config = { api: { bodyParser: false } }` (or equivalent `next.config.js` setting for the route).

Behaviour on `checkout.session.completed`: verifies signature → updates `payment_status = PAID` via Service_Role_Key → returns 200. On signature failure: logs, returns 400. On any other event type: returns 200 (acknowledge but ignore).

#### Client-Side PDF Page Counting

`pdfjs-dist` is loaded dynamically (lazy import) in the browser to extract `numPages` from the uploaded PDF before the file is sent to storage. This value is stored in the Print_Job record and used for price calculation. If `pdfjs-dist` fails for any reason, the page count defaults to 1 and a notice is displayed.

```typescript
// lib/pdf-page-count.ts
export async function getPdfPageCount(file: File): Promise<number | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return doc.numPages;
  } catch {
    return null;
  }
}
```

#### Pricing Logic (Pure Function)

```typescript
// lib/pricing.ts
export interface KioskConfig {
  bwPricePerPage: number;   // e.g. 0.05
  colourSurcharge: number;  // e.g. 0.10
  currency: string;         // e.g. "GBP"
}

export function calculatePrice(
  config: KioskConfig,
  pageCount: number,
  copies: number,
  colourMode: 'bw' | 'colour'
): { perPagePrice: number; total: number } {
  const perPagePrice =
    colourMode === 'colour'
      ? config.bwPricePerPage + config.colourSurcharge
      : config.bwPricePerPage;
  const total = perPagePrice * pageCount * copies;
  return { perPagePrice, total };
}
```

#### Filename Sanitisation

```typescript
// lib/filename.ts
export function sanitizeFilename(raw: string): string {
  const withoutExtension = raw.replace(/\.pdf$/i, '');
  const sanitized = withoutExtension
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100);
  return (sanitized || 'document') + '.pdf';
}
```

### Print Controller

#### Directory Structure

```
/print-controller/
├── main.py               # Entry point: loads config, starts polling loop
├── config.py             # Env var loading and validation
├── poller.py             # Poll + atomic claim logic
├── downloader.py         # File download with retry/backoff
├── validator.py          # PDF magic byte check
├── printer.py            # Cross-platform print dispatch
├── updater.py            # Supabase status update calls
├── logger.py             # Structured logging setup (stdout + rotating file)
├── requirements.txt
└── .env.example
```

#### Module Interfaces

**config.py**
```python
@dataclass
class Config:
    supabase_url: str
    supabase_service_role_key: str
    printer_name: str
    poll_interval: int  # seconds, 5–300

def load_config() -> Config:
    """Load from environment / .env. Raises SystemExit on missing required vars."""
```

**poller.py**
```python
def claim_next_job(supabase: Client) -> dict | None:
    """
    Atomically UPDATE job_status='PRINTING' WHERE payment_status='PAID'
    AND job_status='QUEUED' RETURNING *.
    Returns the claimed job dict, or None if no qualifying job exists.
    Raises on network error (caller logs and skips cycle).
    """
```

**downloader.py**
```python
def download_file(supabase: Client, file_path: str, dest_dir: Path) -> Path:
    """
    Downloads file_path from Supabase Storage to a temp file in dest_dir.
    Retries up to 3× with exponential backoff (5s, 10s, 20s).
    Raises DownloadError after exhausting retries.
    """
```

**validator.py**
```python
def is_valid_pdf(path: Path) -> bool:
    """Returns True iff the first 4 bytes of the file are b'%PDF'."""
```

**printer.py**
```python
def print_file(file_path: Path, printer_name: str, copies: int) -> None:
    """
    Dispatches to the OS-appropriate print command:
    - Linux/macOS: lp -d <printer_name> -n <copies> <file>
    - Windows:     SumatraPDF.exe -print-to <printer_name> -print-settings "<copies>x" <file>
    Raises PrintError on non-zero exit code or subprocess exception.
    """
```

#### Cross-Platform Printing Strategy

| OS | Command | Notes |
|----|---------|-------|
| Linux | `lp -d {printer_name} -n {copies} {file}` | CUPS-based; widely available |
| macOS | `lp -d {printer_name} -n {copies} {file}` | CUPS-based on macOS |
| Windows | `SumatraPDF.exe -print-to "{printer_name}" -print-settings "{copies}x" "{file}"` | Requires SumatraPDF in PATH or configured path |

The Windows strategy uses SumatraPDF (free, silent printing CLI) rather than `win32print` which requires pywin32 and is more complex for PDF rendering. The `PRINTER_NAME` env var is passed verbatim — no fallback to the system default printer. If the printer is unavailable, the subprocess exits non-zero and the job is marked FAILED.

#### Polling Loop (main.py)

```python
def run_forever(config: Config) -> None:
    supabase = create_client(config.supabase_url, config.supabase_service_role_key)
    recover_stale_jobs(supabase)   # Mark PRINTING → FAILED on startup
    while True:
        try:
            run_one_cycle(supabase, config)
        except Exception as e:
            logger.exception("Unhandled exception in polling loop", exc_info=e)
        time.sleep(config.poll_interval)
```

```python
def run_one_cycle(supabase: Client, config: Config) -> None:
    try:
        job = claim_next_job(supabase)
    except NetworkError as e:
        logger.warning("Network error during poll, skipping cycle", error=str(e))
        return
    if job is None:
        logger.debug("No qualifying jobs found")
        return
    process_job(supabase, job, config)
```

---

## Data Models

### Supabase: print_jobs Table

```sql
CREATE TABLE print_jobs (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name        TEXT          NOT NULL,
  file_path        TEXT          NOT NULL,
  copies           INTEGER       NOT NULL DEFAULT 1,
  print_options    JSONB         NOT NULL DEFAULT '{}',
  payment_status   TEXT          NOT NULL DEFAULT 'PENDING',
  job_status       TEXT          NOT NULL DEFAULT 'QUEUED',
  error_message    TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  printed_at       TIMESTAMPTZ,
  total_price      NUMERIC(10,2) NOT NULL,
  page_count       INTEGER       NOT NULL DEFAULT 1,

  CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDING','PAID','FAILED')),
  CONSTRAINT chk_job_status     CHECK (job_status IN ('QUEUED','PRINTING','PRINTED','FAILED')),
  CONSTRAINT chk_copies         CHECK (copies BETWEEN 1 AND 99),
  CONSTRAINT chk_total_price    CHECK (total_price >= 0),
  CONSTRAINT chk_page_count     CHECK (page_count >= 1)
);
```

### print_options JSONB Shape

```json
{
  "orientation": "portrait" | "landscape",
  "colourMode": "bw" | "colour"
}
```

### RLS Policies

```sql
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Allow any anon client to insert a new job (only with PENDING/QUEUED)
CREATE POLICY "anon_insert" ON print_jobs
  FOR INSERT TO anon
  WITH CHECK (payment_status = 'PENDING' AND job_status = 'QUEUED');

-- Allow any client to read a job by its id
CREATE POLICY "anon_select" ON print_jobs
  FOR SELECT TO anon
  USING (true);

-- Deny anon UPDATE entirely (no UPDATE policy for anon role)
-- Only service_role (bypasses RLS) can UPDATE
```

Note: `service_role` bypasses RLS by default in Supabase — no explicit policy is needed for it. The absence of an `anon` UPDATE policy is what enforces the restriction.

### Supabase Storage

- Bucket name: `print-files`
- Access: private (no public URLs)
- File path convention: `jobs/{job_id}/{sanitized_filename}.pdf`
- Signed upload URL expiry: 2 hours (upload phase)
- Signed download URL expiry: 60 minutes (preview in web app)
- Print Controller access: direct download via Service_Role_Key (`storage.from_('print-files').download(path)`)

### TypeScript Types

```typescript
// types/print-job.ts
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';
export type JobStatus = 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED';

export interface PrintJob {
  id: string;
  file_name: string;
  file_path: string;
  copies: number;
  print_options: {
    orientation: 'portrait' | 'landscape';
    colourMode: 'bw' | 'colour';
  };
  payment_status: PaymentStatus;
  job_status: JobStatus;
  error_message: string | null;
  created_at: string;
  printed_at: string | null;
  total_price: number;
  page_count: number;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  QUEUED:   'Waiting to print',
  PRINTING: 'Printing now',
  PRINTED:  'Ready for collection',
  FAILED:   'Print failed',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Awaiting payment',
  PAID:    'Payment confirmed',
  FAILED:  'Payment failed',
};
```

### Environment Variables

**Web App (Vercel)**

| Variable | Visibility | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key for client-side Supabase calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Privileged key for API routes and webhook handler |
| `STRIPE_SECRET_KEY` | Server-only | Stripe API secret for creating checkout sessions |
| `STRIPE_WEBHOOK_SECRET` | Server-only | Stripe webhook signing secret |
| `NEXT_PUBLIC_BW_PRICE_PER_PAGE` | Public | Base price per page in pence/cents |
| `NEXT_PUBLIC_COLOUR_SURCHARGE` | Public | Additional cost per page for colour |
| `NEXT_PUBLIC_CURRENCY` | Public | Currency code (e.g. `GBP`) |

**Print Controller (.env)**

| Variable | Required | Default | Purpose |
|----------|---------|---------|---------|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Privileged key |
| `PRINTER_NAME` | Yes | — | Printer name as known to OS |
| `POLL_INTERVAL_SECONDS` | No | `10` | Poll interval (5–300) |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filename sanitisation produces valid, bounded output

*For any* input filename string, the sanitised output SHALL contain only alphanumeric characters, hyphens, and underscores (plus a `.pdf` suffix), SHALL NOT be empty, and the base name (excluding the `.pdf` suffix) SHALL NOT exceed 100 characters.

**Validates: Requirements 2.6**

### Property 2: File validation rejects invalid type or size

*For any* file-like input, the client-side validator SHALL accept the file if and only if its MIME type is `application/pdf` AND its size in bytes is less than or equal to 20,971,520 (20 MB). Any file failing either condition SHALL be rejected.

**Validates: Requirements 2.2, 2.3**

### Property 3: Price formula is exact linear multiplication

*For any* valid per-page price, page count ≥ 1, and copies count between 1 and 99, the `calculatePrice` function SHALL return a total equal to `perPagePrice × pageCount × copies`.

**Validates: Requirements 4.1**

### Property 4: Colour surcharge is always non-negative

*For any* valid kiosk configuration, the colour per-page price SHALL be greater than or equal to the Black & White per-page price (`colourPrice >= bwPrice`).

**Validates: Requirements 4.2**

### Property 5: Price summary display always contains all required fields

*For any* valid combination of copies, colour mode, page count, and kiosk config, the rendered `PriceSummary` component SHALL display a per-page price, the page count, the copies count, and the total — all formatted with exactly two decimal places.

**Validates: Requirements 3.5, 4.3, 4.4**

### Property 6: Print options serialisation round-trip is lossless

*For any* valid `print_options` object (orientation and colourMode values), serialising it to JSON and deserialising it SHALL produce an object equal to the original.

**Validates: Requirements 3.6**

### Property 7: Status screen displays non-empty labels for all status values

*For any* `PrintJob` with any valid `job_status` and `payment_status` combination, the status screen SHALL render a non-empty human-readable label for each status field — no status value SHALL map to `undefined`, an empty string, or a raw enum key.

**Validates: Requirements 6.2, 6.3**

### Property 8: RLS anon key cannot escalate payment status to PAID

*For any* existing `print_jobs` row, an UPDATE operation targeting `payment_status = 'PAID'` issued with the Anon_Key SHALL be rejected by the RLS policy, leaving the row unchanged.

**Validates: Requirements 5.6, 8.4**

### Property 9: PDF magic byte validation is correct for all byte sequences

*For any* byte sequence, `is_valid_pdf` SHALL return `True` if and only if the first four bytes are `%PDF` (0x25 0x50 0x44 0x46), and `False` for all other sequences including empty files and partial matches.

**Validates: Requirements 12.5, 12.6**

---

## Error Handling

### Web Application Error Catalogue

| Scenario | User-Facing Message | HTTP Status | Behaviour |
|---------|-------------------|------------|-----------|
| File type not PDF | "Only PDF files are supported." | — (client validation) | Upload blocked |
| File > 20 MB | "File size must not exceed 20 MB." | — (client validation) | Upload blocked |
| Supabase Storage upload failure | "Upload failed. Please try again." | 500 | No Print_Job created |
| Print_Job DB insert failure | "Unable to start print job. Please try again." | 500 | Already-uploaded file deleted (rollback) |
| Signed URL generation failure | "Unable to preview file." | 500 | Preview unavailable; job can still proceed |
| Stripe Checkout Session creation failure | "Unable to initiate payment. Please try again." | 500 | Print_Job remains PENDING |
| Stripe webhook signature failure | — (no user-facing) | 400 | Logged; payment_status unchanged |
| Job not found by ID | "Print job not found." | 404 | Status page shows error |
| Job in FAILED state | error_message or "An error occurred" | 200 | Status page shows message |

### Print Controller Error Catalogue

| Scenario | Action | Log Level |
|---------|--------|-----------|
| Missing required env var | `sys.exit(1)` with descriptive message | CRITICAL |
| Supabase auth failure | Halt with descriptive error | CRITICAL |
| Network error during poll | Skip cycle, retry next interval | WARNING |
| Job claim returns 0 rows (race) | Skip silently | DEBUG |
| Download failure (< 3 retries) | Retry with backoff (5s → 10s → 20s) | WARNING |
| Download failure (exhausted) | `job_status=FAILED`, `error_message=<reason>` | ERROR |
| Invalid PDF magic bytes | `job_status=FAILED`, `error_message="Downloaded file is not a valid PDF"` | ERROR |
| Printer unavailable / bad name | `job_status=FAILED`, `error_message=<reason>` | ERROR |
| Unhandled exception in loop | Log exception, restart loop | ERROR |
| Startup with PRINTING jobs | Mark all PRINTING → FAILED, `error_message="Controller restarted"` | WARNING |

### Rollback Strategy: Upload Without DB Record

If a file is uploaded to Supabase Storage but the subsequent `print_jobs` INSERT fails:
1. The API route catches the insert error.
2. It calls `storage.from_('print-files').remove([uploadPath])` with the Service_Role_Key.
3. If the storage delete also fails, it logs the orphaned path for manual cleanup — the user receives a 500 error regardless.

This ensures no orphaned files accumulate under normal failure conditions.

---

## Testing Strategy

### Web Application

**Unit tests** (Jest + React Testing Library):
- `lib/pricing.ts`: specific price calculations for B&W and colour modes, boundary copies values (1, 99)
- `lib/filename.ts`: sanitisation of special characters, spaces, long names, empty strings
- `lib/pdf-page-count.ts`: mocked `pdfjs-dist` returns expected page count; handles rejection
- `components/PrintOptionsForm.tsx`: option changes trigger price recalculation within 300ms
- `app/status/[id]/page.tsx`: all status/payment label mappings render correct text

**Property-based tests** (fast-check, min 100 iterations each):
- Property 1: `sanitizeFilename` — arbitrary string input produces only valid chars, non-empty, ≤ 100 char base
  ```typescript
  // Feature: a4-print-kiosk, Property 1: Filename sanitisation produces valid, bounded output
  ```
- Property 2: File validation — arbitrary MIME type + size accepts only PDF ≤ 20 MB
  ```typescript
  // Feature: a4-print-kiosk, Property 2: File validation rejects invalid type or size
  ```
- Property 3: `calculatePrice` — for arbitrary pageCount/copies/pricePerPage, total equals formula
  ```typescript
  // Feature: a4-print-kiosk, Property 3: Price formula is exact linear multiplication
  ```
- Property 4: `calculatePrice` with colour — colour price is always ≥ B&W price
  ```typescript
  // Feature: a4-print-kiosk, Property 4: Colour surcharge is always non-negative
  ```
- Property 5: `PriceSummary` render — for arbitrary valid inputs, all four fields appear with 2 d.p.
  ```typescript
  // Feature: a4-print-kiosk, Property 5: Price summary display always contains all required fields
  ```
- Property 6: `print_options` serialisation — arbitrary valid options object round-trips through JSON
  ```typescript
  // Feature: a4-print-kiosk, Property 6: Print options serialisation round-trip is lossless
  ```
- Property 7: Status labels — for arbitrary `JobStatus`/`PaymentStatus`, label lookup returns non-empty string
  ```typescript
  // Feature: a4-print-kiosk, Property 7: Status screen displays non-empty labels for all status values
  ```
- Property 8: RLS escalation — integration property test against test Supabase project
  ```typescript
  // Feature: a4-print-kiosk, Property 8: RLS anon key cannot escalate payment status to PAID
  ```

**Integration tests** (Playwright):
- Full upload → options → payment success flow against a test Supabase project and Stripe test mode
- Mobile viewport (375px) rendering: no horizontal scroll, touch targets ≥ 44×44px
- Step indicator shows correct active step at each page

### Print Controller

**Unit tests** (pytest):
- `validator.py`: `is_valid_pdf` with valid PDF bytes, non-PDF bytes, empty file, partial `%PD` sequence
- `config.py`: `load_config` raises `SystemExit` on each missing required variable independently
- `printer.py`: `print_file` dispatches correct command for each OS (mocked subprocess)
- `downloader.py`: retry logic exhausts 3 attempts before raising `DownloadError`; backoff intervals correct
- `poller.py`: `claim_next_job` returns `None` when no rows are returned (mocked Supabase)

**Property-based tests** (Hypothesis, min 100 iterations):
- Property 9: `is_valid_pdf` — for any byte sequence, returns True iff starts with `%PDF`
  ```python
  # Feature: a4-print-kiosk, Property 9: PDF magic byte validation is correct for all byte sequences
  ```

**Integration tests** (against a test Supabase project):
- End-to-end: insert PAID+QUEUED job → controller picks it up → marks PRINTING → PRINTED
- Startup recovery: insert a PRINTING job → restart controller → job marked FAILED

### Property Test Configuration

- Minimum **100 iterations** per property test
- `fast-check` for TypeScript/Next.js properties
- `Hypothesis` for Python print controller properties
- Each test carries a comment tag referencing the design property number and description
