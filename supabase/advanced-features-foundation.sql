-- ============================================================
-- Bumblebee — Advanced Features Foundation
-- أدوات متقدمة
-- ============================================================

-- ─── Cost Entries (بنود التكاليف) ───────────────────────────

CREATE TABLE IF NOT EXISTS cost_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sales_order_id      UUID REFERENCES work_items(id) ON DELETE SET NULL,
  production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
  cost_type           TEXT NOT NULL DEFAULT 'material'
                      CHECK (cost_type IN ('material','labor','overhead','subcontract','transport','other')),
  description         TEXT NOT NULL,
  quantity            NUMERIC(12,2) DEFAULT 1,
  unit_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency            TEXT DEFAULT 'EGP',
  date                DATE DEFAULT CURRENT_DATE,
  supplier            TEXT,
  notes               TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_entries_ws ON cost_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_so ON cost_entries(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_po ON cost_entries(production_order_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_type ON cost_entries(workspace_id, cost_type);

-- ─── Branches (الفروع) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS branches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  branch_code         TEXT NOT NULL,
  name                TEXT NOT NULL,
  name_ar             TEXT,
  address             TEXT,
  phone               TEXT,
  manager_name        TEXT,
  branch_type         TEXT DEFAULT 'factory'
                      CHECK (branch_type IN ('factory','showroom','warehouse','office')),
  is_active           BOOLEAN DEFAULT true,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_ws ON branches(workspace_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_entries_workspace" ON cost_entries
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "branches_workspace" ON branches
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Triggers ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_cost_entries_updated ON cost_entries;
CREATE TRIGGER trg_cost_entries_updated BEFORE UPDATE ON cost_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_branches_updated ON branches;
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
