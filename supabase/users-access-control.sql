-- Users, Roles & Access Control Migration
-- Sprint C: Multi-user access with role-based permissions

-- ═══════════════════════════════════════════════════════════
-- Extend workspace_members with role + department + permissions
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer';
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS department TEXT;
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS display_name TEXT;
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invited_by UUID;
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- Invitations table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  department TEXT,
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending', -- pending, accepted, expired, cancelled
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON workspace_invitations(token);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER avoids circular RLS on workspace_members)
CREATE OR REPLACE FUNCTION can_manage_invitations(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_member_direct(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "invitations_select_v2" ON workspace_invitations
  FOR SELECT USING (is_workspace_member_direct(workspace_id));

CREATE POLICY "invitations_insert_v2" ON workspace_invitations
  FOR INSERT WITH CHECK (can_manage_invitations(workspace_id));

CREATE POLICY "invitations_update_v2" ON workspace_invitations
  FOR UPDATE USING (can_manage_invitations(workspace_id));

CREATE POLICY "invitations_delete_v2" ON workspace_invitations
  FOR DELETE USING (can_manage_invitations(workspace_id));

-- ═══════════════════════════════════════════════════════════
-- Role definitions (reference, not enforced in DB)
-- ═══════════════════════════════════════════════════════════

COMMENT ON TABLE workspace_members IS '
Roles:
  owner    — Full access, can delete workspace
  admin    — Full access, cannot delete workspace
  manager  — All modules, can approve/release
  finance  — Finance, invoices, payments, approve financial steps
  sales    — Customers, quotations, sales orders
  production — Production orders, manufacturing stages, QC
  warehouse — Inventory, stock movements, material requirements
  viewer   — Read-only access to all modules
';

-- ═══════════════════════════════════════════════════════════
-- Release/Approval States for work_items
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE work_items ADD COLUMN IF NOT EXISTS release_status TEXT DEFAULT 'draft';
  ALTER TABLE work_items ADD COLUMN IF NOT EXISTS release_history JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- release_status values: draft, waiting_approval, released, blocked, rejected
-- release_history: [{role, user_id, action, timestamp, note}]

-- ═══════════════════════════════════════════════════════════
-- Stock movements table (enhanced inventory)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id UUID NOT NULL, -- references resources.id (inventory item)
  movement_type TEXT NOT NULL, -- stock_in, stock_out, reservation, adjustment, transfer, consumption
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'pcs',
  reference_type TEXT, -- sales_order, production_order, purchase_order, adjustment
  reference_id UUID,
  from_location TEXT,
  to_location TEXT,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_workspace ON stock_movements(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_workspace_access" ON stock_movements
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════
-- Extend resources (inventory items) with stock fields
-- ═══════════════════════════════════════════════════════════

-- These are stored in metadata JSON for flexibility:
-- metadata.current_qty, metadata.reserved_qty, metadata.reorder_level,
-- metadata.incoming_qty, metadata.unit_cost, metadata.supplier_id,
-- metadata.location, metadata.last_counted_at
