-- Connected Furniture Engine — Migration
-- Adds material_requirements table for BOM→Inventory→Purchase connection

-- material_requirements: tracks what materials are needed per sales/production order
CREATE TABLE IF NOT EXISTS material_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'sales_order', -- sales_order, production_order
  source_id UUID NOT NULL,
  material_name TEXT NOT NULL,
  sku TEXT,
  quantity_required NUMERIC NOT NULL DEFAULT 0,
  quantity_available NUMERIC NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  quantity_to_purchase NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, available, reserved, purchase_requested, ordered, received
  purchase_request_id UUID,
  inventory_item_id UUID,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE material_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_requirements_workspace"
  ON material_requirements FOR ALL
  USING (workspace_id = (current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (current_setting('app.workspace_id', true))::uuid);

CREATE INDEX idx_material_requirements_workspace ON material_requirements(workspace_id);
CREATE INDEX idx_material_requirements_source ON material_requirements(source_type, source_id);
CREATE INDEX idx_material_requirements_status ON material_requirements(status);
