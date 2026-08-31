-- ============================================================
-- Bumblebee ERP — Quotations Foundation Migration
-- ============================================================
-- This migration is OPTIONAL. The quotations module currently
-- stores data in the work_items table (type = 'quotation' or
-- 'sales_order') with line items in the metadata JSON field.
--
-- Run this migration ONLY when you need dedicated tables for
-- better querying, indexing, or reporting on quotation data.
-- ============================================================

-- Quotations table (dedicated, if needed in future)
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quotation_number TEXT NOT NULL,
  customer_id UUID REFERENCES organizations(id),
  customer_name TEXT,
  contact_person TEXT,
  project_name TEXT,
  quotation_date DATE DEFAULT CURRENT_DATE,
  validity_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  material_cost NUMERIC(12,2) DEFAULT 0,
  labor_cost NUMERIC(12,2) DEFAULT 0,
  accessories_cost NUMERIC(12,2) DEFAULT 0,
  transport_cost NUMERIC(12,2) DEFAULT 0,
  installation_cost NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  converted_to UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotation line items
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  width_cm NUMERIC(8,2),
  height_cm NUMERIC(8,2),
  depth_cm NUMERIC(8,2),
  material TEXT,
  finish TEXT,
  color TEXT,
  accessories TEXT,
  installation_required BOOLEAN DEFAULT FALSE,
  delivery_required BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_quotations" ON quotations
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_quotation_items" ON quotation_items
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_workspace ON quotations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
