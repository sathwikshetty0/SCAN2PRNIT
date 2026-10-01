# Requirements Document

## Introduction

The A4 Print Kiosk is a self-service document printing system that allows users to scan a QR code at a physical kiosk, upload a document via a mobile-friendly web application hosted on Vercel, select print options, complete payment, and have the document automatically printed on a locally connected A4 printer. The system is designed as a prototype with a laptop acting as the print controller, architected for easy replacement with a Raspberry Pi in a future phase.

The system is composed of three main subsystems:
- **Web Application**: A Next.js frontend hosted on Vercel for the user-facing upload, options selection, and payment flow.
- **Supabase Backend**: Manages the database (print jobs), file storage, authentication, and Row Level Security.
- **Print Controller**: A Python service running on a laptop that polls for paid jobs and drives the USB-connected A4 printer.

## Glossary

- **Print_Kiosk**: The physical kiosk unit displaying a QR code that initiates the print session.
- **Web_App**: The Next.js web application hosted on Vercel, accessed by users via the QR code URL.
- **Supabase**: The backend-as-a-service platform providing the PostgreSQL database, storage, and authentication.
- **Print_Job**: A database record representing a single user print request, including file, options, payment, and status.
- **Print_Controller**: The Python application running on the laptop that processes paid print jobs and communicates with the printer.
- **Payment_Gateway**: The third-party payment provider used to process payments (integrated in sandbox/test mode for the prototype).
- **Printer**: The USB-connected A4 printer physically attached to the laptop.
- **Job_Status**: The current processing state of a Print_Job — one of: `QUEUED`, `PRINTING`, `PRINTED`, `FAILED`.
- **Payment_Status**: The payment state of a Print_Job — one of: `PENDING`, `PAID`, `FAILED`.
- **Signed_URL**: A time-limited, cryptographically signed URL that grants temporary read access to a file in Supabase Storage without exposing permanent credentials.
- **Service_Role_Key**: The privileged Supabase API key that bypasses Row Level Security — must never be exposed to the frontend.
- **RLS**: Row Level Security — PostgreSQL policies enforced by Supabase to control data access per user and role.
- **Anon_Key**: The public Supabase API key safe for use in the frontend; subject to RLS.

---

## Requirements

### Requirement 1: QR Code Entry Point

**User Story:** As a user at the kiosk, I want to scan a QR code to open the print application on my phone, so that I can start a print job without installing any app.

#### Acceptance Criteria

1. THE Print_Kiosk SHALL display a QR code that encodes the URL of the Web_App's upload page.
2. WHEN a user scans the QR code with a mobile device, THE Web_App SHALL open directly on the file upload page.
3. THE Web_App SHALL be accessible via HTTPS on a Vercel-hosted domain.

---

### Requirement 2: File Upload

**User Story:** As a user, I want to upload a PDF document from my phone, so that I can submit it for printing.

#### Acceptance Criteria

1. THE Web_App SHALL provide a file upload interface that accepts PDF files only.
2. WHEN a user selects a file, THE Web_App SHALL validate that the file type is `application/pdf`.
3. WHEN a user selects a file, THE Web_App SHALL validate that the file size does not exceed 20 MB.
4. IF a user selects a file with an unsupported type, THEN THE Web_App SHALL display an error message stating "Only PDF files are supported."
5. IF a user selects a file exceeding the size limit, THEN THE Web_App SHALL display an error message stating "File size must not exceed 20 MB."
6. WHEN a valid PDF file is uploaded, THE Web_App SHALL sanitize the filename by removing special characters and replacing spaces with underscores before storage.
7. WHEN a valid PDF file is uploaded, THE Web_App SHALL store the file in Supabase Storage under a path scoped to the Print_Job identifier.
8. WHEN the file is successfully stored, THE Web_App SHALL create a Print_Job record in Supabase with `payment_status = PENDING` and `job_status = QUEUED`.
9. IF file upload to Supabase Storage fails, THEN THE Web_App SHALL display an error message and SHALL NOT create a Print_Job record.

---

### Requirement 3: File Preview and Print Options

**User Story:** As a user, I want to review my uploaded file and configure print options before paying, so that I get exactly what I expect.

#### Acceptance Criteria

1. WHEN a Print_Job is created, THE Web_App SHALL display the filename and file size to the user for confirmation.
2. THE Web_App SHALL allow the user to select the number of copies as a positive integer between 1 and 99.
3. THE Web_App SHALL provide a print option for page orientation: `Portrait` or `Landscape`.
4. THE Web_App SHALL provide a print option for colour mode: `Black & White` or `Colour`.
5. WHEN the user changes any print option or the number of copies, THE Web_App SHALL recalculate and display the total price in real time.
6. THE Web_App SHALL store selected print options in the `print_options` field of the Print_Job as a JSON object.

---

### Requirement 4: Price Calculation

**User Story:** As a user, I want to see a clear price breakdown before paying, so that I know exactly what I will be charged.

#### Acceptance Criteria

1. THE Web_App SHALL calculate the total price using the formula: `base_price_per_page × page_count × copies`.
2. THE Web_App SHALL apply a surcharge for colour printing relative to the Black & White base price.
3. THE Web_App SHALL display a price summary showing the per-page price, number of pages, number of copies, and total amount.
4. THE Web_App SHALL display all prices in the local currency with two decimal places.
5. WHEN the page count cannot be determined from the PDF, THE Web_App SHALL use the user-declared page count or default to 1 for price calculation purposes, and SHALL display a notice to the user. This requirement applies only to the fallback case; when the page count is determinable from the PDF, the PDF-derived page count SHALL be used.

---

### Requirement 5: Payment Flow

**User Story:** As a user, I want to pay for my print job securely, so that my job is processed only after successful payment.

#### Acceptance Criteria

1. WHEN the user confirms print options and total price, THE Web_App SHALL initiate a payment session with the Payment_Gateway for the calculated amount.
2. THE Web_App SHALL redirect the user to the Payment_Gateway's hosted checkout page to complete payment.
3. WHEN the Payment_Gateway notifies the system of a successful payment, THE Web_App server-side handler SHALL verify the payment authenticity using the Payment_Gateway's webhook signature.
4. IF the webhook signature verification fails, THEN THE Web_App server-side handler SHALL reject the notification, leave the Print_Job `payment_status` as `PENDING`, log the invalid signature attempt, and return a 400 response to the Payment_Gateway.
5. WHEN payment is verified as successful by the server-side handler, THE Supabase backend SHALL update the Print_Job `payment_status` to `PAID`.
6. IF a user attempts to mark their own Print_Job `payment_status` as `PAID` directly via the client, THEN THE Supabase RLS policy SHALL reject the operation.
7. WHEN payment fails or is cancelled, THE Web_App SHALL display an error message and the Print_Job `payment_status` SHALL remain `PENDING`.
8. THE Web_App SHALL display a payment success screen after confirmed payment, showing the Print_Job identifier and an estimated wait time.

---

### Requirement 6: Job Status Tracking

**User Story:** As a user, I want to track the status of my print job after paying, so that I know when my document is ready.

#### Acceptance Criteria

1. THE Web_App SHALL provide a job status screen accessible via the Print_Job identifier.
2. WHEN a user views the job status screen, THE Web_App SHALL display the current `job_status` and `payment_status`.
3. THE Web_App SHALL display a human-readable label for each status value: `QUEUED` → "Waiting to print", `PRINTING` → "Printing now", `PRINTED` → "Ready for collection", `FAILED` → "Print failed".
4. WHEN `job_status` is `FAILED`, THE Web_App SHALL display the `error_message` field to the user.
5. THE Web_App SHALL refresh the job status automatically at a regular interval of no less than every 10 seconds while the user is viewing the status screen.

---

### Requirement 7: Supabase Database Schema

**User Story:** As a developer, I want a well-defined database schema, so that all system components interact with a consistent data model.

#### Acceptance Criteria

1. THE Supabase database SHALL contain a `print_jobs` table with the following columns: `id` (UUID, primary key, default `gen_random_uuid()`), `file_name` (TEXT, NOT NULL), `file_path` (TEXT, NOT NULL), `copies` (INTEGER, NOT NULL, default 1), `print_options` (JSONB, NOT NULL, default `{}`), `payment_status` (TEXT, NOT NULL, default `PENDING`), `job_status` (TEXT, NOT NULL, default `QUEUED`), `error_message` (TEXT, nullable), `created_at` (TIMESTAMPTZ, NOT NULL, default `now()`), `printed_at` (TIMESTAMPTZ, nullable), `total_price` (NUMERIC(10,2), NOT NULL), `page_count` (INTEGER, NOT NULL, default 1).
2. THE Supabase database SHALL enforce a CHECK constraint on `payment_status` restricting values to `PENDING`, `PAID`, `FAILED`.
3. THE Supabase database SHALL enforce a CHECK constraint on `job_status` restricting values to `QUEUED`, `PRINTING`, `PRINTED`, `FAILED`.
4. THE Supabase database SHALL enforce a CHECK constraint on `copies` restricting values to the range 1–99 inclusive.

---

### Requirement 8: Row Level Security Policies

**User Story:** As a security-conscious developer, I want RLS policies to enforce access control, so that users cannot access or modify other users' jobs or escalate payment status.

#### Acceptance Criteria

1. THE Supabase `print_jobs` table SHALL have RLS enabled.
2. THE Supabase RLS policy SHALL allow any client to INSERT a new Print_Job row with `payment_status = PENDING` and `job_status = QUEUED`.
3. THE Supabase RLS policy SHALL allow any client to SELECT a Print_Job row by its `id`.
4. THE Supabase RLS policy SHALL deny any client UPDATE to the `payment_status` column via the Anon_Key.
5. THE Supabase RLS policy SHALL allow only the Service_Role_Key (server-side) to UPDATE `payment_status` and `job_status`.
6. THE Supabase RLS policy SHALL deny DELETE operations on Print_Job rows for callers authenticated with the Anon_Key; privileged roles such as the Service_Role_Key MAY perform DELETE operations.

---

### Requirement 9: Supabase Storage Security

**User Story:** As a developer, I want uploaded files to be stored securely, so that only authorised components can access them.

#### Acceptance Criteria

1. THE Supabase Storage bucket for print files SHALL be configured as private (not publicly accessible).
2. WHEN the Web_App needs to display or preview a file, THE Web_App server-side SHALL generate a Signed_URL with a maximum expiry of 60 minutes.
3. THE Print_Controller SHALL use the Service_Role_Key to download files from Supabase Storage directly.
4. THE Web_App frontend SHALL never receive or store the Service_Role_Key.

---

### Requirement 10: Print Controller — Polling

**User Story:** As a system operator, I want the Print_Controller to automatically detect paid print jobs, so that printing begins without manual intervention.

#### Acceptance Criteria

1. THE Print_Controller SHALL authenticate with Supabase using the Service_Role_Key stored in a local environment variable or `.env` file.
2. THE Print_Controller SHALL poll the Supabase `print_jobs` table at a configurable interval (default: 10 seconds) for rows where `payment_status = PAID` and `job_status = QUEUED`.
3. WHEN a qualifying Print_Job is found, THE Print_Controller SHALL update `job_status` to `PRINTING` before downloading the file, to prevent duplicate processing.
4. THE Print_Controller SHALL use an atomic update with a WHERE clause checking `job_status = QUEUED` to prevent two concurrent Print_Controller instances from processing the same job.
5. THE Print_Controller SHALL log each polling cycle result, including the number of jobs found and any errors encountered.

---

### Requirement 11: Print Controller — File Download and Printing

**User Story:** As a system operator, I want the Print_Controller to download and print files automatically, so that paid jobs are fulfilled without manual steps.

#### Acceptance Criteria

1. WHEN a Print_Job is claimed (status set to `PRINTING`), THE Print_Controller SHALL download the file from Supabase Storage to a local temporary directory.
2. WHEN the file is downloaded, THE Print_Controller SHALL send the PDF to the printer name specified in the `PRINTER_NAME` environment variable; IF a configured printer name is provided and that printer is unavailable or invalid, THEN THE Print_Controller SHALL mark the job as `FAILED` with an appropriate error message and SHALL NOT fall back to the system default printer.
3. THE Print_Controller SHALL pass the `copies` value from the Print_Job to the print command.
4. WHEN printing completes successfully, THE Print_Controller SHALL update the Print_Job `job_status` to `PRINTED` and set `printed_at` to the current UTC timestamp.
5. IF printing fails for any reason, THEN THE Print_Controller SHALL update `job_status` to `FAILED` and store the error description in the `error_message` column.
6. THE Print_Controller SHALL delete the locally downloaded temporary file after the job status has been updated, regardless of success or failure.
7. THE Print_Controller SHALL support PDF printing on Windows, macOS, and Linux host operating systems.

---

### Requirement 12: Print Controller — Resilience and Logging

**User Story:** As a system operator, I want the Print_Controller to be resilient and well-logged, so that I can diagnose issues and the service recovers from transient errors.

#### Acceptance Criteria

1. THE Print_Controller SHALL run as a continuous service, restarting its polling loop after any unhandled exception without exiting.
2. THE Print_Controller SHALL write structured log entries to both stdout and a rotating log file, including timestamp, job ID, and event description for every state change.
3. WHEN a network error occurs during Supabase polling, THE Print_Controller SHALL log the error and retry after the configured polling interval without marking any job as `FAILED`.
4. WHEN a file download fails, THE Print_Controller SHALL retry the download up to 3 times with exponential backoff before marking the job as `FAILED`.
5. THE Print_Controller SHALL check that the downloaded file is a valid PDF before sending it to the Printer.
6. IF the downloaded file is not a valid PDF, THEN THE Print_Controller SHALL update `job_status` to `FAILED` with an appropriate error message and SHALL NOT send the file to the Printer.

---

### Requirement 13: Environment Configuration and Secret Management

**User Story:** As a developer, I want all secrets and environment-specific values managed through environment variables, so that no credentials are hardcoded or exposed.

#### Acceptance Criteria

1. THE Web_App SHALL read the Supabase URL and Anon_Key from environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. THE Web_App server-side SHALL read the Supabase Service_Role_Key from a server-only environment variable (`SUPABASE_SERVICE_ROLE_KEY`) not prefixed with `NEXT_PUBLIC_`.
3. THE Web_App server-side SHALL read the Payment_Gateway secret key from a server-only environment variable.
4. THE Print_Controller SHALL read all Supabase credentials and printer configuration from a `.env` file or OS environment variables.
5. THE Web_App repository SHALL include a `.env.example` file listing all required environment variable names without values.
6. IF a required environment variable is missing at startup, THEN THE Print_Controller SHALL log a descriptive error message and exit with a non-zero status code.

---

### Requirement 14: Mobile-First Web UI

**User Story:** As a user accessing the kiosk via my phone, I want a clean mobile-first interface, so that I can complete my print job without difficulty on a small screen.

#### Acceptance Criteria

1. THE Web_App SHALL render correctly on viewport widths from 375px to 1280px, and SHALL independently satisfy correct rendering at exactly 375px and at exactly 1280px as mandatory boundary conditions.
2. THE Web_App SHALL use a single-column layout on mobile viewports (< 768px).
3. THE Web_App SHALL display a clear step indicator showing the user's current position in the workflow: Upload → Options → Payment → Status.
4. THE Web_App SHALL use touch-friendly controls with interactive elements at least 44×44 CSS pixels in size.
5. THE Web_App SHALL display loading states during all asynchronous operations (file upload, payment initiation, status polling).
6. THE Web_App SHALL meet WCAG 2.1 AA colour contrast requirements for all text elements.

---

### Requirement 15: Modular Print Controller Architecture

**User Story:** As a developer, I want the print controller to be loosely coupled from the web application, so that I can replace the laptop with a Raspberry Pi without changing the frontend.

#### Acceptance Criteria

1. THE Print_Controller SHALL interact with the system exclusively through the Supabase database and Supabase Storage APIs, with no direct dependency on the Web_App.
2. THE Web_App SHALL interact with the Print_Controller exclusively through the shared Supabase database state, with no direct network calls to the Print_Controller.
3. THE Print_Controller source code SHALL be maintained in a separate directory (`/print-controller`) from the web application code.
4. THE Print_Controller SHALL read all hardware-specific configuration (printer name, polling interval) from environment variables, so that no code changes are required when deploying to a different host device.
