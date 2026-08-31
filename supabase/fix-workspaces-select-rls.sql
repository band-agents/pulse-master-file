-- ============================================================
-- Bumblebee — Fix: workspaces SELECT policy blocks INSERT…RETURNING
--
-- Run this in Supabase SQL Editor.
--
-- Root cause: workspaces_select uses is_workspace_member(id),
-- but during onboarding the workspace_members row doesn't exist
-- yet when the INSERT…RETURNING fires. PostgreSQL evaluates the
-- SELECT policy on RETURNING rows, so the insert fails with
-- 42501 even though the INSERT policy itself passes.
--
-- Fix: let the workspace owner always read their own workspace.
-- ============================================================

DROP POLICY IF EXISTS "workspaces_select" ON workspaces;

CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT USING (owner_id = auth.uid() OR is_workspace_member(id));
