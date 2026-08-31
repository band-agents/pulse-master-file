-- ============================================================
-- Bumblebee ERP — Product Catalog + BOM Foundation Migration
-- ============================================================
-- OPTIONAL. Currently products are stored in the resources
-- table (type = 'product') with BOM, costing, and stages
-- in the metadata JSON field.
--
-- Run this migration when you need dedicated tables for
-- better querying, indexing, or complex BOM operations.
-- ============================================================

-- Products catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  sku TEXT,
  category TEXT,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  -- Dimensions (cm)
  width NUMERIC(8,2),
  height NUMERIC(8,2),
  depth NUMERIC(8,2),
  thickness NUMERIC(8,2),
  weight NUMERIC(8,2),
  -- Materials
  main_material TEXT,
  secondary_material TEXT,
  finish TEXT,
  paint TEXT,
  hardware TEXT,
  edge_banding TEXT,
  -- Costing
  material_cost NUMERIC(12,2) DEFAULT 0,
  labor_cost NUMERIC(12,2) DEFAULT 0,
  machine_cost NUMERIC(12,2) DEFAULT 0,
  overhead_cost NUMERIC(12,2) DEFAULT 0,
  suggested_price NUMERIC(12,2),
  currency TEXT DEFAULT 'EGP',
  -- Meta
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill of Materials
CREATE TABLE IF NOT EXISTS product_bom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  quantity NUMERIC(10,3) DEFAULT 1,
  unit TEXT DEFAULT 'piece',
  cost_per_unit NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manufacturing stages / templates
CREATE TABLE IF NOT EXISTS product_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  estimated_hours NUMERIC(6,2),
  department TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_products" ON products
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_product_bom" ON product_bom
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_product_stages" ON product_stages
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(workspace_id, category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(workspace_id, sku);
CREATE INDEX IF NOT EXISTS idx_product_bom_product ON product_bom(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stages_product ON product_stages(product_id);
