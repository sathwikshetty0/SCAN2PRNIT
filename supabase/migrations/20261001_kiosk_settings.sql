CREATE TABLE IF NOT EXISTS kiosk_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_paused  BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO kiosk_settings (id, is_paused)
VALUES ('00000000-0000-0000-0000-000000000001', false)
ON CONFLICT (id) DO NOTHING;
