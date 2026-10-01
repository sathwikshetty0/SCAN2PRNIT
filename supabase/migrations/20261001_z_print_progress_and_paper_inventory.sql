ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS estimated_sheets_printed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS print_progress_known BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS paper_inventory (
  id                SMALLINT PRIMARY KEY CHECK (id = 1),
  remaining_sheets  INTEGER CHECK (remaining_sheets >= 0),
  low_alert_sent    BOOLEAN NOT NULL DEFAULT false,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO paper_inventory (id, remaining_sheets)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE paper_inventory ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON paper_inventory TO service_role;

CREATE TABLE IF NOT EXISTS paper_inventory_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type  TEXT NOT NULL CHECK (event_type IN ('initial_count', 'refill', 'printed', 'wasted')),
  quantity    INTEGER NOT NULL,
  job_id      UUID REFERENCES print_jobs(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_inventory_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON paper_inventory_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE paper_inventory_events_id_seq TO service_role;
ALTER TABLE printer_status ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON printer_status TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "anon_select" ON print_jobs;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'printer_status'
      AND policyname = 'anon_read_printer_status'
  ) THEN
    CREATE POLICY anon_read_printer_status ON printer_status
      FOR SELECT TO anon USING (true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION refill_paper_inventory(p_sheets INTEGER, p_initial BOOLEAN)
RETURNS TABLE (remaining_sheets INTEGER, low_alert BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_sheets INTEGER;
  next_sheets INTEGER;
  alert_needed BOOLEAN;
BEGIN
  IF p_sheets <= 0 THEN
    RAISE EXCEPTION 'Sheet quantity must be positive';
  END IF;

  SELECT pi.remaining_sheets INTO current_sheets
  FROM paper_inventory AS pi
  WHERE pi.id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paper inventory row is missing';
  END IF;

  IF p_initial THEN
    IF current_sheets IS NOT NULL THEN
      RAISE EXCEPTION 'Initial paper count has already been set';
    END IF;
    next_sheets := p_sheets;
  ELSE
    IF current_sheets IS NULL THEN
      RAISE EXCEPTION 'Set the initial paper count before recording a refill';
    END IF;
    next_sheets := current_sheets + p_sheets;
  END IF;

  alert_needed := next_sheets <= 15;

  UPDATE paper_inventory AS pi
  SET remaining_sheets = next_sheets,
      low_alert_sent = alert_needed,
      updated_at = now()
  WHERE pi.id = 1;

  INSERT INTO paper_inventory_events (event_type, quantity)
  VALUES (CASE WHEN p_initial THEN 'initial_count' ELSE 'refill' END, p_sheets);

  RETURN QUERY SELECT next_sheets, alert_needed;
END;
$$;

CREATE OR REPLACE FUNCTION record_print_progress(p_job_id UUID, p_cumulative_sheets INTEGER)
RETURNS TABLE (estimated_sheets_printed INTEGER, remaining_sheets INTEGER, low_alert BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  prior_sheets INTEGER;
  active_status TEXT;
  sheet_delta INTEGER;
  current_sheets INTEGER;
  was_alerted BOOLEAN;
  next_sheets INTEGER;
  alert_needed BOOLEAN := false;
BEGIN
  IF p_cumulative_sheets < 0 THEN
    RAISE EXCEPTION 'Cumulative printed sheets cannot be negative';
  END IF;

  SELECT pj.estimated_sheets_printed, pj.job_status
    INTO prior_sheets, active_status
  FROM print_jobs AS pj
  WHERE pj.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND OR active_status <> 'PRINTING' THEN
    RAISE EXCEPTION 'Print job is not active';
  END IF;

  IF p_cumulative_sheets <= prior_sheets THEN
    SELECT pi.remaining_sheets INTO current_sheets
    FROM paper_inventory AS pi
    WHERE pi.id = 1;
    RETURN QUERY SELECT prior_sheets, current_sheets, false;
    RETURN;
  END IF;

  sheet_delta := p_cumulative_sheets - prior_sheets;
  UPDATE print_jobs AS pj
  SET estimated_sheets_printed = p_cumulative_sheets,
      print_progress_known = true
  WHERE pj.id = p_job_id;

  SELECT pi.remaining_sheets, pi.low_alert_sent
    INTO current_sheets, was_alerted
  FROM paper_inventory AS pi
  WHERE pi.id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paper inventory row is missing';
  END IF;

  IF current_sheets IS NOT NULL THEN
    next_sheets := GREATEST(0, current_sheets - sheet_delta);
    alert_needed := current_sheets > 15 AND next_sheets <= 15 AND NOT was_alerted;

    UPDATE paper_inventory AS pi
    SET remaining_sheets = next_sheets,
        low_alert_sent = was_alerted OR alert_needed,
        updated_at = now()
    WHERE pi.id = 1;

    INSERT INTO paper_inventory_events (event_type, quantity, job_id)
    VALUES ('printed', -sheet_delta, p_job_id);
  ELSE
    next_sheets := NULL;
  END IF;

  RETURN QUERY SELECT p_cumulative_sheets, next_sheets, alert_needed;
END;
$$;

CREATE OR REPLACE FUNCTION record_wasted_paper(p_sheets INTEGER)
RETURNS TABLE (remaining_sheets INTEGER, low_alert BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_sheets INTEGER;
  was_alerted BOOLEAN;
  next_sheets INTEGER;
  alert_needed BOOLEAN;
BEGIN
  IF p_sheets <= 0 THEN
    RAISE EXCEPTION 'Sheet quantity must be positive';
  END IF;

  SELECT pi.remaining_sheets, pi.low_alert_sent
    INTO current_sheets, was_alerted
  FROM paper_inventory AS pi
  WHERE pi.id = 1
  FOR UPDATE;

  IF NOT FOUND OR current_sheets IS NULL THEN
    RAISE EXCEPTION 'Set the initial paper count before recording waste';
  END IF;

  next_sheets := GREATEST(0, current_sheets - p_sheets);
  alert_needed := current_sheets > 15 AND next_sheets <= 15 AND NOT was_alerted;

  UPDATE paper_inventory AS pi
  SET remaining_sheets = next_sheets,
      low_alert_sent = was_alerted OR alert_needed,
      updated_at = now()
  WHERE pi.id = 1;

  INSERT INTO paper_inventory_events (event_type, quantity)
  VALUES ('wasted', -p_sheets);

  RETURN QUERY SELECT next_sheets, alert_needed;
END;
$$;

REVOKE ALL ON FUNCTION refill_paper_inventory(INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION record_print_progress(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION record_wasted_paper(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refill_paper_inventory(INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION record_print_progress(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION record_wasted_paper(INTEGER) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'print_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'printer_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.printer_status;
  END IF;
END;
$$;
