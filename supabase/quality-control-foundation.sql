-- ============================================================
-- Bumblebee — Quality Control Foundation
-- مراقبة الجودة
-- ============================================================

-- ─── QC Inspections (فحوصات الجودة) ──────────────────────

CREATE TABLE IF NOT EXISTS qc_inspections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  inspection_number   TEXT NOT NULL,
  production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
  sales_order_id      UUID REFERENCES work_items(id) ON DELETE SET NULL,
  customer_name       TEXT,
  inspector_name      TEXT,
  inspection_type     TEXT DEFAULT 'final'
                      CHECK (inspection_type IN ('in_process','pre_assembly','final','pre_delivery','re_inspection')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','passed','failed','conditional')),
  -- Checklist (JSON array of {id, label_en, label_ar, passed, notes})
  checklist           JSONB DEFAULT '[]'::jsonb,
  overall_score       INTEGER,
  result_notes        TEXT,
  inspected_at        TIMESTAMPTZ,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_inspections_ws ON qc_inspections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_po ON qc_inspections(production_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_status ON qc_inspections(workspace_id, status);

-- ─── QC Defects (عيوب التصنيع) ────────────────────────────

CREATE TABLE IF NOT EXISTS qc_defects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  inspection_id     UUID NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
  defect_number     TEXT NOT NULL,
  title             TEXT NOT NULL,
  severity          TEXT DEFAULT 'minor'
                    CHECK (severity IN ('critical','major','minor','cosmetic')),
  category          TEXT DEFAULT 'other'
                    CHECK (category IN ('dimension','surface','material','assembly','finish','hardware','edge','color','other')),
  description       TEXT,
  location          TEXT,
  photo_url         TEXT,
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','rework','re_inspected','accepted','rejected')),
  rework_notes      TEXT,
  reworked_by       TEXT,
  reworked_at       TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_defects_insp ON qc_defects(inspection_id);
CREATE INDEX IF NOT EXISTS idx_qc_defects_ws   ON qc_defects(workspace_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qc_inspections_workspace" ON qc_inspections
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "qc_defects_workspace" ON qc_defects
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Storage bucket for defect photos ─────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('qc-photos', 'qc-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "qc_photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'qc-photos');

CREATE POLICY "qc_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'qc-photos');

-- ─── Triggers ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_qc_inspections_updated ON qc_inspections;
CREATE TRIGGER trg_qc_inspections_updated BEFORE UPDATE ON qc_inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_qc_defects_updated ON qc_defects;
CREATE TRIGGER trg_qc_defects_updated BEFORE UPDATE ON qc_defects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
