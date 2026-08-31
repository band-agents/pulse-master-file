-- ============================================================
-- Bumblebee — Delivery & Installation Foundation
-- التسليم والتركيب
-- ============================================================

-- ─── Deliveries (التسليمات) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  delivery_number     TEXT NOT NULL,
  production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
  sales_order_id      UUID REFERENCES work_items(id) ON DELETE SET NULL,
  customer_name       TEXT,
  customer_phone      TEXT,
  delivery_address    TEXT,
  delivery_date       DATE,
  delivery_time_slot  TEXT,  -- e.g. "10:00-12:00"
  driver_name         TEXT,
  vehicle_info        TEXT,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','loading','in_transit','delivered','failed','cancelled')),
  loading_notes       TEXT,
  delivery_notes      TEXT,
  recipient_name      TEXT,   -- who received it
  recipient_phone     TEXT,
  delivered_at        TIMESTAMPTZ,
  delivery_photo_url  TEXT,
  num_pieces          INTEGER DEFAULT 0,
  num_packages        INTEGER DEFAULT 0,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_ws ON deliveries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_po ON deliveries(production_order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(workspace_id, delivery_date);

-- ─── Installations (التركيبات) ──────────────────────────────

CREATE TABLE IF NOT EXISTS installations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installation_number TEXT NOT NULL,
  delivery_id         UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  sales_order_id      UUID REFERENCES work_items(id) ON DELETE SET NULL,
  customer_name       TEXT,
  customer_phone      TEXT,
  site_address        TEXT,
  scheduled_date      DATE,
  scheduled_time_slot TEXT,
  team_leader         TEXT,
  team_members        JSONB DEFAULT '[]'::jsonb,  -- array of names
  status              TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','in_progress','completed','on_hold','cancelled')),
  -- Checklist (JSON array of {id, label_en, label_ar, passed, notes})
  checklist           JSONB DEFAULT '[]'::jsonb,
  -- Snag list (JSON array of {id, title, severity, status, photo_url, notes})
  snag_list           JSONB DEFAULT '[]'::jsonb,
  completion_notes    TEXT,
  customer_rating     INTEGER CHECK (customer_rating IS NULL OR (customer_rating >= 1 AND customer_rating <= 5)),
  customer_feedback   TEXT,
  signature_url       TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  photos              JSONB DEFAULT '[]'::jsonb,  -- array of {url, caption, type}
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installations_ws ON installations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_installations_delivery ON installations(delivery_id);
CREATE INDEX IF NOT EXISTS idx_installations_status ON installations(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_installations_date ON installations(workspace_id, scheduled_date);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliveries_workspace" ON deliveries
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "installations_workspace" ON installations
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Storage bucket for installation photos & signatures ──

INSERT INTO storage.buckets (id, name, public)
VALUES ('installation-photos', 'installation-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "installation_photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'installation-photos');

CREATE POLICY "installation_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'installation-photos');

-- ─── Triggers ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_deliveries_updated ON deliveries;
CREATE TRIGGER trg_deliveries_updated BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_installations_updated ON installations;
CREATE TRIGGER trg_installations_updated BEFORE UPDATE ON installations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
