-- ═══════════════════════════════════════════════════════════
-- Bumblebee Sprint 2: Admin Users + Permissions + Analytics
-- Migration: admin-users-analytics.sql
-- ═══════════════════════════════════════════════════════════

-- ─── 1. Add permissions JSONB to workspace_members ───────
-- Stores granular per-user permissions as { module: [actions] }

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT;

COMMENT ON COLUMN workspace_members.permissions IS 'Granular permissions map: { "orders": ["view","create","edit"], "inventory": ["view"] }';
COMMENT ON COLUMN workspace_members.department IS 'Employee department (sales, production, warehouse, etc.)';
COMMENT ON COLUMN workspace_members.display_name IS 'Display name for the user in the workspace';
COMMENT ON COLUMN workspace_members.job_title IS 'Employee job title';

-- ─── 2. Role templates table ────────────────────────────
-- Stores customizable role templates per workspace

CREATE TABLE IF NOT EXISTS role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  is_system BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT 'bg-slate-100 text-slate-600',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, name)
);

COMMENT ON TABLE role_templates IS 'Custom role templates with granular permission maps';

-- RLS for role_templates
ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_templates_workspace_read" ON role_templates
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "role_templates_admin_write" ON role_templates
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ─── 3. Saved reports table ─────────────────────────────
-- Stores user-created custom report configurations

CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE saved_reports IS 'User-saved custom report configurations with data source, filters, grouping, metrics';
COMMENT ON COLUMN saved_reports.config IS '{ dataSource, dateRange, groupBy, metric, chartType, filters: [{field, operator, value}] }';

-- RLS for saved_reports
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_reports_read" ON saved_reports
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    AND (is_shared = TRUE OR created_by = auth.uid())
  );

CREATE POLICY "saved_reports_write_own" ON saved_reports
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "saved_reports_update_own" ON saved_reports
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "saved_reports_delete_own" ON saved_reports
  FOR DELETE USING (created_by = auth.uid());

-- ─── 4. Permission check function ──────────────────────
-- Server-side permission check for RLS policies

CREATE OR REPLACE FUNCTION check_user_permission(
  p_workspace_id UUID,
  p_module TEXT,
  p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_permissions JSONB;
  v_module_perms JSONB;
BEGIN
  -- Get user's role and permissions
  SELECT role, COALESCE(permissions, '{}'::jsonb)
  INTO v_role, v_permissions
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  -- Owner and admin have full access
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Check granular permissions
  v_module_perms := v_permissions -> p_module;
  IF v_module_perms IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_module_perms ? p_action;
END;
$$;

COMMENT ON FUNCTION check_user_permission IS 'Check if current user has specific permission on a module within a workspace';

-- ─── 5. Indexes ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workspace_members_permissions
  ON workspace_members USING GIN (permissions);

CREATE INDEX IF NOT EXISTS idx_role_templates_workspace
  ON role_templates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_saved_reports_workspace
  ON saved_reports(workspace_id);

CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by
  ON saved_reports(created_by);

-- ─── 6. Updated_at trigger ──────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'role_templates_updated_at') THEN
    CREATE TRIGGER role_templates_updated_at
      BEFORE UPDATE ON role_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'saved_reports_updated_at') THEN
    CREATE TRIGGER saved_reports_updated_at
      BEFORE UPDATE ON saved_reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- EDGE FUNCTION PLAN: Admin User Creation
-- ═══════════════════════════════════════════════════════════
--
-- The frontend cannot securely create Supabase auth users.
-- Deploy a Supabase Edge Function at: /functions/v1/admin-create-user
--
-- Request body:
--   { workspace_id, email, password, name, department, job_title, role_template, permissions }
--
-- Edge Function logic:
--   1. Verify caller is owner/admin of the workspace (check JWT + workspace_members)
--   2. supabase.auth.admin.createUser({ email, password, email_confirm: true })
--   3. Insert profile row
--   4. Insert workspace_members row with permissions JSONB
--   5. Return { user_id, member_id }
--
-- Environment: SUPABASE_SERVICE_ROLE_KEY (only in Edge Function, never in frontend)
--
-- Example Edge Function skeleton:
--
-- import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
-- import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
--
-- serve(async (req) => {
--   const supabaseAdmin = createClient(
--     Deno.env.get('SUPABASE_URL')!,
--     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
--   )
--
--   // Verify caller from Authorization header
--   const authHeader = req.headers.get('Authorization')!
--   const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
--
--   const body = await req.json()
--
--   // Check caller is admin/owner
--   const { data: membership } = await supabaseAdmin
--     .from('workspace_members')
--     .select('role')
--     .eq('workspace_id', body.workspace_id)
--     .eq('user_id', caller.id)
--     .single()
--
--   if (!membership || !['owner', 'admin'].includes(membership.role)) {
--     return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
--   }
--
--   // Create auth user
--   const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
--     email: body.email,
--     password: body.password,
--     email_confirm: true,
--     user_metadata: { display_name: body.name },
--   })
--
--   if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })
--
--   // Create workspace member
--   await supabaseAdmin.from('workspace_members').insert({
--     workspace_id: body.workspace_id,
--     user_id: newUser.user.id,
--     role: body.role_template === 'admin' ? 'admin' : 'member',
--     department: body.department,
--     display_name: body.name,
--     job_title: body.job_title,
--     permissions: body.permissions,
--     status: 'active',
--   })
--
--   return new Response(JSON.stringify({ user_id: newUser.user.id }), { status: 201 })
-- })
-- ═══════════════════════════════════════════════════════════
