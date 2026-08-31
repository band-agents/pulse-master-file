-- ============================================================
-- Bumblebee ERP — Sales Orders Foundation Migration
-- ============================================================
-- OPTIONAL. Currently sales orders are stored in the work_items
-- table (type = 'sales_order') with items, payments, and
-- readiness checklist in the metadata JSON field.
--
-- Run this migration when you need dedicated tables for
-- better querying, reporting, or payment tracking.
-- ============================================================

-- Sales Orders
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  so_number TEXT NOT NULL,
  customer_type TEXT DEFAULT 'individual', -- individual | company
  customer_id UUID REFERENCES organizations(id),
  customer_name TEXT,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  company_name TEXT,
  project_name TEXT,
  project_location TEXT,
  po_number TEXT,
  payment_terms TEXT,
  source_quotation_id UUID,
  source_quotation_number TEXT,
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  delivery_required BOOLEAN DEFAULT TRUE,
  installation_required BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  currency TEXT DEFAULT 'EGP',
  -- Production readiness
  customer_confirmed BOOLEAN DEFAULT FALSE,
  measurements_done BOOLEAN DEFAULT FALSE,
  design_approved BOOLEAN DEFAULT FALSE,
  materials_available BOOLEAN DEFAULT FALSE,
  deposit_received BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Order Items
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
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
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Order Payments
CREATE TABLE IF NOT EXISTS sales_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE,
  paid_date DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_sales_orders" ON sales_orders
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_sales_order_items" ON sales_order_items
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_sales_order_payments" ON sales_order_payments
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_orders_workspace ON sales_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_items_order ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_so_payments_order ON sales_order_payments(sales_order_id);
