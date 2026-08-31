-- ============================================================
-- Bumblebee — Measurements & Site Visits Foundation
-- معاينات ومقاسات
-- ============================================================

-- ─── Site Visits (معاينات) ────────────────────────────────

CREATE TABLE IF NOT EXISTS site_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  visit_number  TEXT NOT NULL,
  sales_order_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  customer_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  customer_name TEXT,
  site_address  TEXT,
  assigned_technician TEXT,
  visit_date    DATE,
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  notes         TEXT,
  -- Customer requirements
  preferred_colors    TEXT,
  preferred_materials TEXT,
  preferred_style     TEXT CHECK (preferred_style IN ('modern','classic','minimal','luxury','custom')),
  special_notes       TEXT,
  installation_notes  TEXT,
  -- Checklist (JSON array of {id, label_en, label_ar, checked})
  checklist     JSONB DEFAULT '[]'::jsonb,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_workspace ON site_visits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_order     ON site_visits(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_status    ON site_visits(workspace_id, status);

-- ─── Measurements (مقاسات) ────────────────────────────────

CREATE TABLE IF NOT EXISTS measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  site_visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  room_name     TEXT NOT NULL,
  room_type     TEXT DEFAULT 'custom'
                CHECK (room_type IN ('kitchen','bedroom','living_room','office','reception','bathroom','custom')),
  label         TEXT,
  width         NUMERIC(10,2),
  height        NUMERIC(10,2),
  depth         NUMERIC(10,2),
  length        NUMERIC(10,2),
  ceiling_height NUMERIC(10,2),
  notes         TEXT,
  approval_status TEXT NOT NULL DEFAULT 'draft'
                CHECK (approval_status IN ('draft','submitted','approved','needs_revision')),
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_measurements_visit ON measurements(site_visit_id);
CREATE INDEX IF NOT EXISTS idx_measurements_ws    ON measurements(workspace_id);

-- ─── Measurement Attachments (صور ومرفقات) ────────────────

CREATE TABLE IF NOT EXISTS measurement_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  site_visit_id   UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  measurement_id  UUID REFERENCES measurements(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_name       TEXT,
  file_type       TEXT CHECK (file_type IN ('site_photo','measurement_photo','reference_image','notes_image')),
  file_size       INTEGER,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meas_attach_visit ON measurement_attachments(site_visit_id);
CREATE INDEX IF NOT EXISTS idx_meas_attach_meas  ON measurement_attachments(measurement_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_visits_workspace" ON site_visits
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "measurements_workspace" ON measurements
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "measurement_attachments_workspace" ON measurement_attachments
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Storage bucket for site visit photos ─────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-visit-photos', 'site-visit-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "site_visit_photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'site-visit-photos');

CREATE POLICY "site_visit_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-visit-photos');

-- ─── Updated_at trigger ───────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_site_visits_updated ON site_visits;
CREATE TRIGGER trg_site_visits_updated BEFORE UPDATE ON site_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_measurements_updated ON measurements;
CREATE TRIGGER trg_measurements_updated BEFORE UPDATE ON measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_meas_attach_updated ON measurement_attachments;
CREATE TRIGGER trg_meas_attach_updated BEFORE UPDATE ON measurement_attachments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
