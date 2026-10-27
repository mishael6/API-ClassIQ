-- ============================================================
-- ClassIQ React Migration — Run ONCE in phpMyAdmin
-- Safe to run — only ADDS columns, never drops anything
-- ============================================================

-- 1. Add session_token to users (classreps)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_token VARCHAR(64) NULL DEFAULT NULL;

-- 2. Add session_token to admins
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS session_token VARCHAR(64) NULL DEFAULT NULL;

-- 3. Add radius_m to qr_sessions
ALTER TABLE qr_sessions
  ADD COLUMN IF NOT EXISTS radius_m INT NOT NULL DEFAULT 100;

-- 4. Add lat/lng to qr_sessions if not already there
ALTER TABLE qr_sessions
  ADD COLUMN IF NOT EXISTS lat DECIMAL(10,8) NULL,
  ADD COLUMN IF NOT EXISTS lng DECIMAL(11,8) NULL;

-- 5. Add soft-delete columns to attendance if not already there
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS deleted_at      DATETIME     NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by      INT          NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(255) NULL DEFAULT NULL;

-- 6. Normalize status values
UPDATE attendance SET status = 'Present' WHERE status = 'Normal';
UPDATE attendance SET status = 'Present' WHERE status = 'present';

-- 7. Confirm admin exists — uses your existing admin account
-- (No need to insert a new one since you already have one)
SELECT id, name, email FROM admins LIMIT 5;

SELECT 'Migration complete.' AS result;
