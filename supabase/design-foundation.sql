-- ============================================================
-- Bumblebee — Design & Technical Drawings Foundation
-- التصميمات والرسومات الفنية
-- ============================================================

-- ─── Design Briefs (ملفات التصميم) ────────────────────────

CREATE TABLE IF NOT EXISTS design_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brief_number    TEXT NOT NULL,
  title           TEXT NOT NULL,
  sales_order_id  UUID REFERENCES work_items(id) ON DELETE SET NULL,
  site_visit_id   UUID REFERENCES site_visits(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
  customer_name   TEXT,
  assigned_designer TEXT,
  -- Design details
  design_type     TEXT DEFAULT 'custom'
                  CHECK (design_type IN ('kitchen','wardrobe','bedroom','living_room','office','bathroom','reception','custom')),
  style           TEXT CHECK (style IN ('modern','classic','minimal','luxury','neo_classic','industrial','custom')),
  -- Dimensions summary (from measurements)
  dimensions_summary JSONB DEFAULT '[]'::jsonb,
  -- Customer requirements (carried from site visit)
  preferred_colors    TEXT,
  preferred_materials TEXT,
  special_notes       TEXT,
  -- Status & approval
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','in_progress','internal_review','client_review','revision','approved','cancelled')),
  version         INTEGER NOT NULL DEFAULT 1,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  revision_notes  TEXT,
  -- Dates
  start_date      DATE,
  due_date        DATE,
  completed_date  DATE,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_briefs_workspace ON design_briefs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_design_briefs_order     ON design_briefs(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_design_briefs_visit     ON design_briefs(site_visit_id);
CREATE INDEX IF NOT EXISTS idx_design_briefs_status    ON design_briefs(workspace_id, status);

-- ─── Design Files (رسومات فنية) ──────────────────────────

CREATE TABLE IF NOT EXISTS design_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  design_brief_id UUID NOT NULL REFERENCES design_briefs(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_name       TEXT,
  file_type       TEXT CHECK (file_type IN ('technical_drawing','3d_render','floor_plan','elevation','detail','reference','revision','client_approved')),
  file_format     TEXT,
  file_size       INTEGER,
  version         INTEGER DEFAULT 1,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_files_brief ON design_files(design_brief_id);

-- ─── Design Comments (تعليقات على التصميم) ────────────────

CREATE TABLE IF NOT EXISTS design_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  design_brief_id UUID NOT NULL REFERENCES design_briefs(id) ON DELETE CASCADE,
  author_name     TEXT NOT NULL,
  author_role     TEXT CHECK (author_role IN ('designer','manager','client','technician')),
  comment         TEXT NOT NULL,
  comment_type    TEXT DEFAULT 'general'
                  CHECK (comment_type IN ('general','revision_request','approval','annotation','question')),
  resolved        BOOLEAN DEFAULT false,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_comments_brief ON design_comments(design_brief_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE design_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design_briefs_workspace" ON design_briefs
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "design_files_workspace" ON design_files
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "design_comments_workspace" ON design_comments
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Storage bucket ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('design-files', 'design-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "design_files_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'design-files');

CREATE POLICY "design_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'design-files');

-- ─── Updated_at triggers ──────────────────────────────────

DROP TRIGGER IF EXISTS trg_design_briefs_updated ON design_briefs;
CREATE TRIGGER trg_design_briefs_updated BEFORE UPDATE ON design_briefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_design_files_updated ON design_files;
CREATE TRIGGER trg_design_files_updated BEFORE UPDATE ON design_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_design_comments_updated ON design_comments;
CREATE TRIGGER trg_design_comments_updated BEFORE UPDATE ON design_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
