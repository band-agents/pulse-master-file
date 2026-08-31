-- ═══════════════════════════════════════════════════════════
-- FIX: workspace_invitations RLS policies
--
-- Root cause of "error creating user" on invite:
--
-- 1. Original policy used FOR ALL USING(...) which can cause
--    issues with INSERT (needs WITH CHECK, not USING)
-- 2. The subquery inside the policy hits workspace_members
--    which itself has RLS enabled → potential circular RLS
-- 3. Role check included 'manager' but workspace_members
--    CHECK constraint only allows: owner/admin/member/viewer
--
-- Fix: Use SECURITY DEFINER function for the permission check
-- to bypass RLS on workspace_members during policy evaluation.
-- ═══════════════════════════════════════════════════════════

-- Step 1: Drop ALL existing policies on workspace_invitations
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'workspace_invitations' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON workspace_invitations', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 2: Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION can_manage_invitations(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_member_direct(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
  );
$$;

-- Step 3: Create clean policies using the helper functions

-- SELECT: any workspace member can see invitations
CREATE POLICY "invitations_select_v2" ON workspace_invitations
  FOR SELECT USING (is_workspace_member_direct(workspace_id));

-- INSERT: owner or admin can create invitations
CREATE POLICY "invitations_insert_v2" ON workspace_invitations
  FOR INSERT WITH CHECK (can_manage_invitations(workspace_id));

-- UPDATE: owner or admin can update invitations (e.g. cancel)
CREATE POLICY "invitations_update_v2" ON workspace_invitations
  FOR UPDATE USING (can_manage_invitations(workspace_id));

-- DELETE: owner or admin can delete invitations
CREATE POLICY "invitations_delete_v2" ON workspace_invitations
  FOR DELETE USING (can_manage_invitations(workspace_id));

-- Step 4: Ensure RLS is enabled
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify — run this to confirm policies are in place
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'workspace_invitations';

-- ═══════════════════════════════════════════════════════════
-- DONE. After running this:
-- 1. Old broken policies are removed
-- 2. New policies use SECURITY DEFINER functions
-- 3. owner + admin can create invitations
-- 4. No more circular RLS issues
-- ═══════════════════════════════════════════════════════════
