-- ─── Asana Integration Migration ─────────────────────────────────────────────

-- Add asana_gid + updated_at to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS asana_gid   TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- Add Asana fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS asana_pat                  TEXT,
  ADD COLUMN IF NOT EXISTS asana_project_gid          TEXT,
  ADD COLUMN IF NOT EXISTS asana_workspace_gid        TEXT,
  ADD COLUMN IF NOT EXISTS asana_deleted_section_gid  TEXT,
  ADD COLUMN IF NOT EXISTS asana_webhook_gid          TEXT,
  ADD COLUMN IF NOT EXISTS asana_webhook_secret       TEXT,
  ADD COLUMN IF NOT EXISTS asana_priority_field_gid   TEXT,
  ADD COLUMN IF NOT EXISTS asana_priority_high_gid    TEXT,
  ADD COLUMN IF NOT EXISTS asana_priority_medium_gid  TEXT,
  ADD COLUMN IF NOT EXISTS asana_priority_low_gid     TEXT,
  ADD COLUMN IF NOT EXISTS asana_sync_enabled         BOOLEAN DEFAULT false;

-- Enable Realtime on tasks table
-- Also go to Supabase Dashboard → Database → Replication and toggle "tasks" ON
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
