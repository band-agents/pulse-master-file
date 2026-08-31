-- ═══════════════════════════════════════════════════════════
-- SHOPIFY SYNC EXPANSION
-- Per-entity sync directions (import / export / two-way / off),
-- generic Bumblebee ↔ Shopify entity mapping, and sync run history.
--
-- Run AFTER loyalty-foundation.sql (extends shopify_connections).
-- ═══════════════════════════════════════════════════════════

-- ─── 1. Sync direction config on the connection ──────────
-- Shape:
-- {
--   "entities": {
--     "products":  "both" | "import" | "export" | "off",
--     "inventory": "both" | "import" | "export" | "off",
--     "orders":    "import" | "off",
--     "customers": "both" | "import" | "export" | "off",
--     "loyalty":   "export" | "off",
--     "analytics": "import" | "off"
--   },
--   "conflict_policy": "latest" | "shopify" | "bumblebee",
--   "auto_sync": true,
--   "sync_interval_minutes": 30
-- }
-- ─── 0. Dev Dashboard auth (client credentials grant) ─────
-- Shopify replaced static custom-app tokens (shpat_) with the
-- Dev Dashboard: apps hold a Client ID + Secret and exchange them
-- for short-lived (~24h) access tokens at /admin/oauth/access_token.
-- access_token_enc now doubles as the cached short-lived token.
ALTER TABLE shopify_connections
  ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT 'access_token',  -- 'access_token' | 'client_credentials'
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS client_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

ALTER TABLE shopify_connections
  ADD COLUMN IF NOT EXISTS sync_config JSONB NOT NULL DEFAULT '{
    "entities": {
      "products": "import",
      "inventory": "off",
      "orders": "import",
      "customers": "import",
      "loyalty": "export",
      "analytics": "import"
    },
    "conflict_policy": "latest",
    "auto_sync": true,
    "sync_interval_minutes": 30
  }'::jsonb;

-- ─── 2. Entity mapping table ──────────────────────────────
-- One row per linked record pair. Lets pulls/pushes upsert
-- instead of duplicating, and powers conflict resolution.

CREATE TABLE IF NOT EXISTS shopify_entity_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  entity_type     TEXT NOT NULL,           -- 'product' | 'variant' | 'customer' | 'order' | 'inventory_item'
  thoth_id        UUID,                    -- products.id / people.id / sales_orders.id / resources.id
  thoth_table     TEXT,                    -- 'products' | 'people' | 'sales_orders' | 'resources' | 'work_items'
  shopify_id      TEXT NOT NULL,           -- numeric Shopify ID or GID
  shopify_handle  TEXT,                    -- product handle / order number (human-readable)

  -- Conflict resolution
  last_synced_at  TIMESTAMPTZ,
  last_direction  TEXT,                    -- 'import' | 'export'
  bumblebee_hash      TEXT,                    -- content hash at last sync (change detection)
  shopify_hash    TEXT,

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, entity_type, shopify_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_entity_map_bumblebee
  ON shopify_entity_map(workspace_id, entity_type, thoth_id);

ALTER TABLE shopify_entity_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shopify_entity_map_workspace" ON shopify_entity_map;
CREATE POLICY "shopify_entity_map_workspace" ON shopify_entity_map
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── 3. Sync run history ──────────────────────────────────
-- One row per sync run (manual "Sync Now" or scheduled).

CREATE TABLE IF NOT EXISTS shopify_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  entity_type     TEXT NOT NULL,           -- 'products' | 'inventory' | 'orders' | 'customers' | 'full'
  direction       TEXT NOT NULL,           -- 'import' | 'export' | 'both'
  trigger_kind    TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'scheduled' | 'webhook'

  status          TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'partial' | 'failed'
  records_pulled  INT NOT NULL DEFAULT 0,
  records_pushed  INT NOT NULL DEFAULT 0,
  records_skipped INT NOT NULL DEFAULT 0,
  conflicts       INT NOT NULL DEFAULT 0,
  error_message   TEXT,

  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,

  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_shopify_sync_runs_ws
  ON shopify_sync_runs(workspace_id, started_at DESC);

ALTER TABLE shopify_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shopify_sync_runs_workspace" ON shopify_sync_runs;
CREATE POLICY "shopify_sync_runs_workspace" ON shopify_sync_runs
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));
