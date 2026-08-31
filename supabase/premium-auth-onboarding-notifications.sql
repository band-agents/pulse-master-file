-- ═══════════════════════════════════════════════════════════
-- Bumblebee — Premium Auth + Onboarding + Notifications Migration
-- ═══════════════════════════════════════════════════════════

-- ─── Notifications table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- null = broadcast
  type         text NOT NULL DEFAULT 'info',
  title        text NOT NULL,
  body         text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'action_required')),
  link         text,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, status);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (
  (user_id = auth.uid()) OR
  (user_id IS NULL AND workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ─── Helper function: create notification ─────────────────

CREATE OR REPLACE FUNCTION create_notification(
  p_workspace_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT '',
  p_link text DEFAULT NULL,
  p_status text DEFAULT 'unread'
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO notifications (workspace_id, user_id, type, title, body, link, status)
  VALUES (p_workspace_id, p_user_id, p_type, p_title, p_body, p_link, p_status)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Auto-notification on release status change ───────────

CREATE OR REPLACE FUNCTION notify_on_release_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.metadata->>'release_status' IS DISTINCT FROM OLD.metadata->>'release_status' THEN
    INSERT INTO notifications (workspace_id, user_id, type, title, body, link)
    VALUES (
      NEW.workspace_id,
      NULL, -- broadcast
      CASE
        WHEN NEW.metadata->>'release_status' = 'released' THEN 'release_approved'
        WHEN NEW.metadata->>'release_status' = 'rejected' THEN 'release_rejected'
        ELSE 'approval_needed'
      END,
      COALESCE(NEW.metadata->>'title', NEW.title, 'Work Item') || ' — ' || COALESCE(NEW.metadata->>'release_status', 'updated'),
      'Release status changed to ' || COALESCE(NEW.metadata->>'release_status', 'unknown'),
      '/' || CASE WHEN NEW.type = 'sales_order' THEN 'orders' ELSE 'work' END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_release_notification ON work_items;
CREATE TRIGGER trg_release_notification
  AFTER UPDATE ON work_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_release_change();

-- ═══════════════════════════════════════════════════════════
-- Done. Tables: notifications
-- Triggers: release status change → auto-notification
-- ═══════════════════════════════════════════════════════════
