-- Add printer_status table to track printer health in real-time
CREATE TABLE IF NOT EXISTS printer_status (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online     BOOLEAN NOT NULL DEFAULT true,
  error_type    TEXT,           -- 'paper_empty' | 'paper_jam' | 'ink_low' | 'offline' | null
  error_message TEXT,
  printer_name  TEXT
);

-- Seed one row (only ever one row, updated in place)
INSERT INTO printer_status (id, is_online, error_type, error_message, printer_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  true, NULL, NULL, 'HP LaserJet Professional M1136 MFP'
)
ON CONFLICT (id) DO NOTHING;
