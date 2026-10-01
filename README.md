# A4 Print Kiosk — End-to-End System Documentation

The **A4 Print Kiosk** is an automated, self-service printing system designed to let users upload PDF documents via their mobile devices (by scanning a QR code), configure print settings, pay securely via Stripe, and automatically receive their printed document from a connected local printer.

---

## 🏗️ Architecture Overview

The system consists of three completely decoupled subsystems that communicate exclusively through **Supabase state**:

```
 ┌──────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
 │   User Mobile Web    │         │  Next.js (Vercel)    │         │  Supabase (Backend)  │
 │                      │ ──────> │                      │ ──────> │                      │
 │ - Scan QR Code       │         │ - /api/create-job    │         │ - print_jobs (DB)    │
 │ - Upload PDF         │         │ - /api/create-check  │         │ - print-files (S3)   │
 │ - Select Options     │         │ - /api/webhooks      │         │ - RLS Security       │
 └──────────────────────┘         └──────────────────────┘         └──────────────────────┘
                                             │                                ▲
                                             ▼                                │
                                  ┌──────────────────────┐                    │
                                  │   Stripe Checkout    │                    │
                                  │                      │                    │
                                  │ - Card Payment       │                    │
                                  │ - Webhook Callback ──┼────────────────────┘
                                  └──────────────────────┘
                                                                              │
                                                                              ▼
                                                                  ┌──────────────────────┐
                                                                  │ Python Controller    │
                                                                  │                      │
                                                                  │ - Polls QUEUED+PAID  │
                                                                  │ - Downloads PDF      │
                                                                  │ - Validates Header   │
                                                                  │ - Dispatches to LP   │
                                                                  └──────────────────────┘
                                                                              │
                                                                              ▼
                                                                   🖨️ USB A4 PRINTER
```

---

## 🔤 Complete System Flow (A to Z)

1. **Step A — QR Code Scanning**:
   - The user scans the kiosk's QR code displayed on screen (`/qr`).
   - The mobile browser opens the Web App home page (`/`).

2. **Step B — File Upload & Validation**:
   - User selects or drops a PDF file (`FileUploadZone.tsx`).
   - Browser validates that the file is an `application/pdf` and $\le 20\text{ MB}$.
   - Browser dynamically loads `pdfjs-dist` to count PDF pages locally.
   - Web App calls `POST /api/create-job` to create a `PENDING` print job in Supabase and retrieve a signed 2-hour upload URL.
   - The browser uploads the PDF directly to Supabase Storage (`print-files` bucket).

3. **Step C — Print Options & Pricing**:
   - User is redirected to `/options?job_id=<ID>&page_count=<N>`.
   - User chooses number of copies (1–99), orientation (Portrait/Landscape), and colour mode (B&W or Colour).
   - Price is dynamically calculated in real time:
     $$\text{Total} = (\text{BW\_Price} + \text{Surcharge}) \times \text{Pages} \times \text{Copies}$$
   - User clicks **Proceed to Payment**.

4. **Step D — Secure Checkout & Webhook**:
   - Web App calls `POST /api/create-checkout`, updating job options in Supabase and initializing a Stripe Checkout session.
   - User completes payment on Stripe's hosted payment page.
   - Stripe sends a `checkout.session.completed` event to `POST /api/webhooks/stripe`.
   - The server verifies the Stripe signature and updates the job status to `payment_status = PAID`.

5. **Step E — Polling & Atomic Claiming**:
   - The local Python Print Controller (`main.py`) polls Supabase every 10 seconds.
   - Controller calls `claim_next_job()` to atomically claim the next `PAID` + `QUEUED` job by setting `job_status = PRINTING`.

6. **Step F — Download, Magic Byte Check & Printing**:
   - Controller downloads the PDF from Supabase Storage with exponential backoff retries (5s, 10s, 20s).
   - Controller verifies the magic byte header (`%PDF`).
   - Controller dispatches the document to the OS print driver (`lp` on Linux/macOS or `SumatraPDF.exe` on Windows).
   - Controller updates `job_status = PRINTED` and sets `printed_at = NOW()`.
   - Controller safely cleans up the temporary downloaded file.

7. **Step G — Real-time Status Updates**:
   - User's mobile browser on `/status/[id]` polls Supabase every 10 seconds to show live progress ("Waiting to print" $\rightarrow$ "Printing now" $\rightarrow$ "Ready for collection").

---

## 🛠️ Setup Guide

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- **Supabase Account & Project**
- **Stripe Account (Test Mode)**

---

### 2. Supabase Configuration

#### Database Schema
Run the following SQL in your Supabase SQL Editor (`supabase/migrations/001_print_jobs.sql`):

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
  total_price      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  page_count       INTEGER       NOT NULL DEFAULT 1,

  CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDING','PAID','FAILED')),
  CONSTRAINT chk_job_status     CHECK (job_status IN ('QUEUED','PRINTING','PRINTED','FAILED')),
  CONSTRAINT chk_copies         CHECK (copies BETWEEN 1 AND 99),
  CONSTRAINT chk_total_price    CHECK (total_price >= 0),
  CONSTRAINT chk_page_count     CHECK (page_count >= 1)
);

-- Row Level Security (RLS)
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert" ON print_jobs
  FOR INSERT TO anon
  WITH CHECK (payment_status = 'PENDING' AND job_status = 'QUEUED');

CREATE POLICY "anon_select" ON print_jobs
  FOR SELECT TO anon
  USING (true);
```

#### Storage Bucket
1. Create a private bucket named **`print-files`**.
2. File paths follow the convention: `jobs/{job_id}/{sanitized_filename}.pdf`.

---

### 3. Environment Variables Setup

#### Web App (`.env.local` or `.env`)
Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BW_PRICE_PER_PAGE=0.05
NEXT_PUBLIC_COLOUR_SURCHARGE=0.10
NEXT_PUBLIC_CURRENCY=GBP
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

#### Print Controller (`print-controller/.env`)
Create a `.env` file inside `print-controller/`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PRINTER_NAME=HP_LaserJet_A4
POLL_INTERVAL_SECONDS=10
```

---

## 🚀 Running the Project

### 1. Web Application
```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the upload interface or [http://localhost:3000/qr](http://localhost:3000/qr) for the kiosk QR display screen.

### 2. Python Print Controller
```bash
cd print-controller

# Install Python requirements
pip install -r requirements.txt

# Run controller loop
python main.py
```

---

## 🧪 Testing Strategy & Verification

### Running Web Application Tests (Jest & fast-check)
Runs unit tests and 8 property-based correctness property suites:
```bash
npm test
```

### Running Print Controller Tests (pytest & Hypothesis)
```bash
cd print-controller
pytest
```

---

## 📁 Repository Structure

```
├── app/
│   ├── api/
│   │   ├── create-job/route.ts      # Creates job & returns signed upload URL
│   │   ├── create-checkout/route.ts # Creates Stripe session
│   │   ├── signed-url/route.ts      # Generates download URL
│   │   └── webhooks/stripe/route.ts # Handles payment confirmation
│   ├── options/page.tsx             # Step 2: Print options & summary
│   ├── payment/
│   │   ├── success/page.tsx         # Payment success page
│   │   └── cancel/page.tsx          # Payment cancellation page
│   ├── status/[id]/page.tsx         # Step 4: Real-time job status page
│   ├── qr/page.tsx                  # Kiosk QR code screen
│   └── page.tsx                     # Step 1: Upload page
├── components/                      # Reusable UI components
├── lib/                             # Core utilities (pricing, filename, pdf, supabase)
├── print-controller/                # Python daemon for local printer dispatch
└── supabase/                        # Database migrations & seeds
```
#   S C A N 2 P R N I T  
 