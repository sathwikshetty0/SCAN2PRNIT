# 🖨️ A4 Print Kiosk

**A self-service, QR-based printing system that lets users upload PDFs, configure print settings, pay online, and collect their documents automatically.**

The **A4 Print Kiosk** is an automated printing solution designed for environments such as colleges, libraries, offices, and public spaces.

Users simply **scan a QR code → upload a PDF → select print options → pay → collect the printed document**.

The system combines a **Next.js web application**, **Supabase backend and storage**, **Stripe payments**, and a **local Python print controller** connected to an A4 printer.

---

## ✨ Features

* 📱 **QR-based access** — Users can access the printing interface directly from their phones.
* 📄 **PDF upload** — Supports PDF documents up to **20 MB**.
* 🔢 **Page detection** — PDF page count is detected automatically.
* ⚙️ **Print customization** — Configure copies, orientation, and colour mode.
* 💳 **Secure payments** — Stripe Checkout handles online payments.
* ☁️ **Cloud-backed jobs** — Print jobs and files are managed through Supabase.
* 🖨️ **Automatic printing** — A local Python controller detects paid jobs and sends them to the printer.
* 🔐 **Database security** — Supabase Row Level Security (RLS) protects job creation and access.
* 🔄 **Job status tracking** — Users can monitor their print status from their mobile device.
* 🧪 **Automated testing** — Web and print-controller components include unit and property-based tests.

---

## 🏗️ System Architecture

The system is divided into independent components that communicate through **Supabase state**.

```text
┌──────────────────────┐
│    User Mobile Web   │
│                      │
│  • Scan QR Code      │
│  • Upload PDF        │
│  • Select Options    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Next.js Web App    │
│      (Vercel)        │
│                      │
│  • Create Job        │
│  • Create Checkout   │
│  • Stripe Webhooks   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│       Supabase       │
│                      │
│  • PostgreSQL DB     │
│  • File Storage      │
│  • RLS Security      │
└──────────┬───────────┘
           │
           │ Paid + Queued Job
           ▼
┌──────────────────────┐
│  Python Controller   │
│                      │
│  • Poll Jobs         │
│  • Download PDF      │
│  • Validate PDF      │
│  • Send to Printer   │
└──────────┬───────────┘
           │
           ▼
      🖨️ A4 PRINTER


        ┌───────────────┐
        │ Stripe        │
        │ Checkout      │
        │               │
        │ Payment       │
        │ Webhook       │
        └───────┬───────┘
                │
                ▼
             Supabase
```

---

## 🔄 How It Works

### 1. Scan QR Code

The kiosk displays a QR code through the `/qr` route.

The user scans it using their mobile device and is redirected to the web application.

### 2. Upload PDF

The user uploads a PDF through the web interface.

The application:

* Validates that the file is a PDF.
* Enforces a **20 MB maximum file size**.
* Uses `pdfjs-dist` to determine the number of pages.
* Creates a print job in Supabase.
* Generates a signed upload URL.
* Uploads the PDF directly to Supabase Storage.

### 3. Configure Print Options

The user selects:

* Number of copies: **1–99**
* Orientation: **Portrait / Landscape**
* Colour mode: **B&W / Colour**

The price is calculated dynamically:

```text
Total Price =
(Base Price + Colour Surcharge)
× Number of Pages
× Number of Copies
```

### 4. Complete Payment

The web application creates a **Stripe Checkout session**.

The user completes payment through Stripe's hosted payment page.

Stripe then sends a:

```text
checkout.session.completed
```

webhook to the application.

The webhook verifies the Stripe signature and updates the job's payment status to:

```text
PAID
```

### 5. Print Controller Claims the Job

The local Python print controller continuously polls Supabase.

Every **10 seconds**, it checks for jobs that are:

```text
payment_status = PAID
job_status     = QUEUED
```

The controller atomically claims the next available job and changes its status to:

```text
PRINTING
```

### 6. PDF Validation & Printing

The controller:

1. Downloads the PDF from Supabase Storage.
2. Retries failed downloads using exponential backoff.
3. Verifies that the file begins with the PDF magic bytes:

```text
%PDF
```

4. Sends the document to the operating system's print driver.
5. Updates the job status to:

```text
PRINTED
```

6. Records the print timestamp.
7. Deletes the temporary downloaded file.

Supported printing approaches:

* **Linux / macOS:** `lp`
* **Windows:** `SumatraPDF.exe`

### 7. Track Print Status

The mobile status page periodically checks the job state and displays progress:

```text
Waiting to print
       ↓
Printing now
       ↓
Ready for collection
```

---

# 🛠️ Tech Stack

| Layer              | Technology          |
| ------------------ | ------------------- |
| Frontend           | Next.js             |
| Backend            | Next.js API Routes  |
| Database           | Supabase PostgreSQL |
| File Storage       | Supabase Storage    |
| Payments           | Stripe Checkout     |
| Print Controller   | Python              |
| PDF Processing     | `pdfjs-dist`        |
| Web Testing        | Jest + fast-check   |
| Controller Testing | pytest + Hypothesis |
| Deployment         | Vercel              |
| Printer Connection | USB                 |

---

# 🚀 Getting Started

## Prerequisites

Make sure the following are installed:

* **Node.js 18+**
* **Python 3.10+**
* **Supabase account and project**
* **Stripe account**
* A compatible A4 printer

---

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <your-repository-name>
```

---

## 2. Configure Supabase

Create a Supabase project and open the **SQL Editor**.

Run the migration located at:

```text
supabase/migrations/001_print_jobs.sql
```

The database contains a `print_jobs` table with fields for:

* Job ID
* File information
* Print options
* Payment status
* Job status
* Page count
* Total price
* Creation timestamp
* Print timestamp
* Error information

### Storage

Create a **private** Supabase Storage bucket:

```text
print-files
```

Files follow this structure:

```text
jobs/{job_id}/{sanitized_filename}.pdf
```

---

# 🔐 Environment Variables

## Web Application

Create `.env.local` in the project root:

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

> ⚠️ **Never commit `.env` or `.env.local` files to GitHub.**

---

## Print Controller

Create:

```text
print-controller/.env
```

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

PRINTER_NAME=HP_LaserJet_A4
POLL_INTERVAL_SECONDS=10
```

---

# ▶️ Running the Project

## Web Application

Install dependencies:

```bash
npm install --legacy-peer-deps
```

Start the development server:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

### Important Routes

| Route              | Purpose               |
| ------------------ | --------------------- |
| `/`                | PDF upload interface  |
| `/qr`              | Kiosk QR code display |
| `/options`         | Print configuration   |
| `/payment/success` | Successful payment    |
| `/payment/cancel`  | Cancelled payment     |
| `/status/[id]`     | Print job status      |

---

## Python Print Controller

Navigate to the controller:

```bash
cd print-controller
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the controller:

```bash
python main.py
```

The controller will continuously monitor Supabase for paid print jobs.

---

# 🧪 Testing

## Web Application

The web application uses **Jest** and **fast-check** for automated testing.

Run:

```bash
npm test
```

This includes unit tests and property-based correctness tests.

## Print Controller

The Python controller uses **pytest** and **Hypothesis**.

Run:

```bash
cd print-controller
pytest
```

---

# 📁 Project Structure

```text
.
├── app/
│   ├── api/
│   │   ├── create-job/
│   │   │   └── route.ts
│   │   ├── create-checkout/
│   │   │   └── route.ts
│   │   ├── signed-url/
│   │   │   └── route.ts
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts
│   │
│   ├── options/
│   │   └── page.tsx
│   │
│   ├── payment/
│   │   ├── success/
│   │   │   └── page.tsx
│   │   └── cancel/
│   │       └── page.tsx
│   │
│   ├── status/
│   │   └── [id]/
│   │       └── page.tsx
│   │
│   ├── qr/
│   │   └── page.tsx
│   │
│   └── page.tsx
│
├── components/
│   └── # Reusable UI components
│
├── lib/
│   └── # Core utilities
│
├── print-controller/
│   ├── main.py
│   ├── requirements.txt
│   └── .env
│
├── supabase/
│   └── migrations/
│       └── 001_print_jobs.sql
│
├── package.json
├── .env.local
└── README.md
```

---

# 🔒 Security Considerations

The system uses several security mechanisms:

* Supabase **Row Level Security (RLS)**
* Private file storage
* Signed upload/download URLs
* Stripe webhook signature verification
* Server-side payment confirmation
* PDF magic-byte validation
* Temporary file cleanup
* Restricted print-job state transitions

### ⚠️ Important

Never expose the following values publicly:

```text
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

These must remain server-side secrets.

---

# 📊 Print Job Lifecycle

A print job moves through the following states:

```text
             ┌──────────┐
             │ PENDING  │
             └────┬─────┘
                  │
                  ▼
             ┌──────────┐
             │ QUEUED   │
             └────┬─────┘
                  │
          Payment Confirmed
                  │
                  ▼
             ┌──────────┐
             │ PRINTING │
             └────┬─────┘
                  │
                  ▼
             ┌──────────┐
             │ PRINTED  │
             └──────────┘

                  │
                  │ Error
                  ▼
             ┌──────────┐
             │ FAILED   │
             └──────────┘
```

Payment status is tracked separately:

```text
PENDING → PAID
       ↘
        FAILED
```

---

# 💰 Pricing

Pricing is configurable through environment variables.

```env
NEXT_PUBLIC_BW_PRICE_PER_PAGE=0.05
NEXT_PUBLIC_COLOUR_SURCHARGE=0.10
NEXT_PUBLIC_CURRENCY=GBP
```

The total is calculated based on:

```text
Price per page
× Number of pages
× Number of copies
```

with the configured colour surcharge applied where applicable.

---

# 🖨️ Deployment Model

The project is designed around a hybrid architecture:

```text
                 INTERNET
                    │
                    ▼
          ┌─────────────────┐
          │   Vercel        │
          │   Next.js App   │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │    Supabase     │
          │ Database + File │
          │    Storage      │
          └────────┬────────┘
                   │
                   │ Internet
                   ▼
          ┌─────────────────┐
          │ Local Computer  │
          │ Python          │
          │ Print Controller│
          └────────┬────────┘
                   │ USB
                   ▼
             🖨️ Printer
```

This allows the web application and local printing hardware to remain decoupled.

---

# 📌 Current Scope

The current system supports:

* PDF-only printing
* QR-based mobile access
* Online payment
* B&W and colour printing
* Portrait and landscape options
* 1–99 copies
* Supabase-backed print queue
* Local automated printing
* Print status tracking
* Automated testing

---

# 🔮 Future Improvements

Potential future enhancements include:

* Raspberry Pi-based dedicated print controller
* Multiple printer support
* Printer health monitoring
* Low-paper / low-toner detection
* Admin dashboard
* Print history and analytics
* Additional document formats
* Improved queue management
* Kiosk hardware integration
* Automated printer recovery

---

# 📄 License

Add your preferred license here before publishing the repository.

For example:

```text
MIT License
```

---

## 👨‍💻 Project

**A4 Print Kiosk**

An automated self-service printing platform combining web technology, cloud infrastructure, payment processing, and local hardware automation.
