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

-- Enable Row Level Security
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Allow any anon client to insert a new job (only with PENDING/QUEUED)
CREATE POLICY "anon_insert" ON print_jobs
  FOR INSERT TO anon
  WITH CHECK (payment_status = 'PENDING' AND job_status = 'QUEUED');

-- Allow any client to read a job by its id
CREATE POLICY "anon_select" ON print_jobs
  FOR SELECT TO anon
  USING (true);

-- Note: No UPDATE/DELETE policy for anon role.
-- service_role bypasses RLS by default in Supabase — no explicit policy needed.
-- The absence of an anon UPDATE policy enforces the payment_status escalation restriction (Requirement 8.4).
