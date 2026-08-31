-- ============================================================
-- Bumblebee — HR & Workforce Foundation
-- الموارد البشرية
-- ============================================================

-- ─── Employees (الموظفين) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_number     TEXT NOT NULL,
  full_name           TEXT NOT NULL,
  full_name_ar        TEXT,
  phone               TEXT,
  email               TEXT,
  national_id         TEXT,
  department          TEXT DEFAULT 'production'
                      CHECK (department IN ('production','finishing','assembly','design','sales','admin','warehouse','delivery','management')),
  job_title           TEXT,
  job_title_ar        TEXT,
  employment_type     TEXT DEFAULT 'full_time'
                      CHECK (employment_type IN ('full_time','part_time','contract','daily')),
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','on_leave','suspended','terminated')),
  hire_date           DATE,
  termination_date    DATE,
  salary              NUMERIC(12,2),
  salary_type         TEXT DEFAULT 'monthly'
                      CHECK (salary_type IN ('monthly','weekly','daily','hourly')),
  photo_url           TEXT,
  emergency_contact   TEXT,
  emergency_phone     TEXT,
  address             TEXT,
  -- Skills (JSON array of {skill, level: 1-5})
  skills              JSONB DEFAULT '[]'::jsonb,
  -- Documents (JSON array of {type, name, url, expiry_date})
  documents           JSONB DEFAULT '[]'::jsonb,
  notes               TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_ws ON employees(workspace_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(workspace_id, department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(workspace_id, status);

-- ─── Attendance (الحضور والانصراف) ──────────────────────────

CREATE TABLE IF NOT EXISTS attendance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  check_in            TIMESTAMPTZ,
  check_out           TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'present'
                      CHECK (status IN ('present','absent','late','half_day','holiday','sick_leave','annual_leave','excused')),
  overtime_hours      NUMERIC(4,1) DEFAULT 0,
  notes               TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_ws ON attendance(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attendance_emp ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(workspace_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);

-- ─── Leave Requests (طلبات الإجازات) ────────────────────────

CREATE TABLE IF NOT EXISTS leave_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type          TEXT NOT NULL DEFAULT 'annual'
                      CHECK (leave_type IN ('annual','sick','unpaid','emergency','maternity','other')),
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  days                INTEGER NOT NULL DEFAULT 1,
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_ws ON leave_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leave_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(workspace_id, status);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_workspace" ON employees
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "attendance_workspace" ON attendance
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "leave_requests_workspace" ON leave_requests
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Storage bucket for employee photos & documents ───────

INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-files', 'employee-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "employee_files_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'employee-files');

CREATE POLICY "employee_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'employee-files');

-- ─── Triggers ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_employees_updated ON employees;
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_attendance_updated ON attendance;
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_leave_requests_updated ON leave_requests;
CREATE TRIGGER trg_leave_requests_updated BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
