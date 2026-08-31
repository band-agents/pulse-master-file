-- ============================================================
-- Bumblebee — Production Planning Foundation
-- تخطيط الإنتاج وأوامر التشغيل
-- ============================================================

-- ─── Production Orders (أوامر التشغيل) ───────────────────

CREATE TABLE IF NOT EXISTS production_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  po_number       TEXT NOT NULL,
  title           TEXT NOT NULL,
  sales_order_id  UUID REFERENCES work_items(id) ON DELETE SET NULL,
  design_brief_id UUID REFERENCES design_briefs(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
  customer_name   TEXT,
  -- Assignment
  assigned_station  TEXT,
  assigned_workers  JSONB DEFAULT '[]'::jsonb,
  -- Scheduling
  priority        TEXT DEFAULT 'medium'
                  CHECK (priority IN ('critical','urgent','high','medium','low')),
  start_date      DATE,
  due_date        DATE,
  completed_date  DATE,
  -- Status
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','cutting','edgebanding','drilling','assembly','finishing','quality_check','packing','ready','delivered','cancelled')),
  current_stage   TEXT DEFAULT 'pending',
  progress        INTEGER DEFAULT 0,
  -- Materials
  materials_summary JSONB DEFAULT '[]'::jsonb,
  -- Notes
  notes           TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_orders_workspace ON production_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_status    ON production_orders(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_prod_orders_so        ON production_orders(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_design    ON production_orders(design_brief_id);

-- ─── Cutting List Items (قائمة التقطيع) ──────────────────

CREATE TABLE IF NOT EXISTS cutting_list_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  piece_number        INTEGER NOT NULL DEFAULT 1,
  part_name           TEXT NOT NULL,
  material            TEXT,
  thickness           NUMERIC(10,2),
  width               NUMERIC(10,2),
  length              NUMERIC(10,2),
  qty                 INTEGER DEFAULT 1,
  edge_top            TEXT,
  edge_bottom         TEXT,
  edge_left           TEXT,
  edge_right          TEXT,
  grain_direction     TEXT CHECK (grain_direction IN ('horizontal','vertical','none')),
  cnc_program         TEXT,
  notes               TEXT,
  completed           BOOLEAN DEFAULT false,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cutting_list_po ON cutting_list_items(production_order_id);

-- ─── Production Stage Log (سجل مراحل التصنيع) ────────────

CREATE TABLE IF NOT EXISTS production_stage_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  stage               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','completed','skipped')),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  duration_minutes    INTEGER,
  worker_name         TEXT,
  station             TEXT,
  notes               TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_log_po ON production_stage_log(production_order_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutting_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_stage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_orders_workspace" ON production_orders
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "cutting_list_items_workspace" ON cutting_list_items
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "production_stage_log_workspace" ON production_stage_log
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Triggers ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_prod_orders_updated ON production_orders;
CREATE TRIGGER trg_prod_orders_updated BEFORE UPDATE ON production_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_cutting_list_updated ON cutting_list_items;
CREATE TRIGGER trg_cutting_list_updated BEFORE UPDATE ON cutting_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_stage_log_updated ON production_stage_log;
CREATE TRIGGER trg_stage_log_updated BEFORE UPDATE ON production_stage_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
