-- Connected Customer & Workflow Experience Migration
-- Sprint B: Customer 360, Activity Events, Workflow Enforcement
-- Run after connected-furniture-engine.sql

-- ═══════════════════════════════════════════════════════════
-- Activity Events table (logs all changes across system)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- entity_created, entity_updated, entity_deleted, status_changed, payment_received, stage_completed, note_added, file_uploaded
  entity_type TEXT NOT NULL, -- organization, person, work_item, resource, production_order
  entity_id UUID,
  actor_id UUID REFERENCES auth.users(id),
  description_en TEXT,
  description_ar TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_workspace ON activity_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at DESC);

-- RLS
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_events_workspace_read" ON activity_events
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "activity_events_workspace_insert" ON activity_events
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════
-- Entity Notes (linked notes for any record)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS entity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  pinned BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_notes_entity ON entity_notes(entity_type, entity_id);

ALTER TABLE entity_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_notes_workspace_access" ON entity_notes
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════
-- Add priority column to work_items if not exists
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE work_items ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- Add customer_id to work_items metadata index for faster lookups
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_work_items_customer_id ON work_items USING gin ((metadata->'customer_id'));
