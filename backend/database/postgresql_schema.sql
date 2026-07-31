-- PostgreSQL schema for NQS National ID System.
-- The current backend uses PostgreSQL through DATABASE_URL.
-- The runtime PostgreSQL adapter creates JSONB document tables automatically.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Mogadishu',
  district TEXT NOT NULL,
  phone TEXT NOT NULL,
  counters INTEGER NOT NULL DEFAULT 5 CHECK (counters >= 0),
  capacity INTEGER NOT NULL DEFAULT 100 CHECK (capacity >= 1),
  hours TEXT NOT NULL DEFAULT '08:00 AM - 05:00 PM',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Maintenance', 'Closed')),
  schedule JSONB NOT NULL DEFAULT '{
    "workingDays": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    "startTime": "08:00",
    "endTime": "16:00",
    "breakTime": {"start": "", "end": ""},
    "slotDuration": 30,
    "maxBookingsPerSlot": 5,
    "maxAppointmentsPerDay": 100,
    "closedDays": ["Friday"],
    "closedDates": [],
    "specialUnavailableDates": [],
    "isActive": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  phone TEXT DEFAULT '',
  national_id TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  date_of_birth TEXT DEFAULT '',
  address TEXT DEFAULT '',
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('admin', 'operator', 'super_operator', 'citizen')),
  operator_type TEXT NOT NULL DEFAULT 'operator' CHECK (operator_type IN ('operator', 'super_operator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_active_at TIMESTAMPTZ,
  center_id TEXT REFERENCES centers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  duration INTEGER NOT NULL DEFAULT 15 CHECK (duration >= 1),
  requirements TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  citizen_name TEXT NOT NULL,
  citizen_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  counter TEXT NOT NULL DEFAULT '--',
  wait_time TEXT NOT NULL DEFAULT '15 min',
  status TEXT NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'Being Served', 'On Hold', 'Completed', 'Cancelled')),
  center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
  appointment_date TEXT DEFAULT '',
  time_slot TEXT,
  request_type TEXT NOT NULL DEFAULT 'new_national_id' CHECK (request_type IN ('new_national_id', 'lost_replacement', 'update_information')),
  request_status TEXT NOT NULL DEFAULT 'Pending' CHECK (request_status IN ('Pending', 'Approved', 'Rejected', 'Completed', 'Resubmission Required')),
  registration_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  replacement_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  update_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  existing_registration JSONB NOT NULL DEFAULT '{}'::jsonb,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  cancellation_reason TEXT DEFAULT '',
  cancellation_reasons TEXT[] NOT NULL DEFAULT '{}',
  additional_cancellation_reason TEXT DEFAULT '',
  cancellation_notes TEXT DEFAULT '',
  cancelled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  needs_resubmission BOOLEAN NOT NULL DEFAULT false,
  resubmission_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'System' CHECK (category IN ('Appointments', 'Queue', 'System')),
  link TEXT DEFAULT '',
  action_url TEXT DEFAULT '',
  related_request_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  ticket_ref TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT DEFAULT '127.0.0.1'
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT DEFAULT '127.0.0.1',
  user_agent TEXT DEFAULT 'Unknown device',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  logged_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'National ID Contact Message',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'In Review', 'Resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_histories (
  id TEXT PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  center_id TEXT REFERENCES centers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  previous_status TEXT DEFAULT '',
  new_status TEXT DEFAULT '',
  performed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  details TEXT DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qr_scans (
  id TEXT PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  ticket_ref TEXT NOT NULL,
  scanned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'valid',
  result TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS counters (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  error TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Logged',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  rating INTEGER,
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  name TEXT DEFAULT '',
  file_url TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'supporting_document',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE TABLE IF NOT EXISTS system_configs (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_center_id ON users(center_id);
CREATE INDEX IF NOT EXISTS idx_centers_district ON centers(district);
CREATE INDEX IF NOT EXISTS idx_tickets_citizen_id ON tickets(citizen_id);
CREATE INDEX IF NOT EXISTS idx_tickets_center_id ON tickets(center_id);
CREATE INDEX IF NOT EXISTS idx_tickets_request_type ON tickets(request_type);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_request_status ON tickets(request_status);
CREATE INDEX IF NOT EXISTS idx_tickets_date_time ON tickets(appointment_date, time_slot);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON active_sessions(user_id, status);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_centers_updated_at ON centers;
CREATE TRIGGER set_centers_updated_at BEFORE UPDATE ON centers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_services_updated_at ON services;
CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON services
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_tickets_updated_at ON tickets;
CREATE TRIGGER set_tickets_updated_at BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_notifications_updated_at ON notifications;
CREATE TRIGGER set_notifications_updated_at BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
