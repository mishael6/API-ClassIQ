-- ============================================================
-- ClassIQ React Migration SQL
-- Run this ONCE on your existing database
-- ============================================================

-- 1. Add session_token to users (classreps) table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_token VARCHAR(64) NULL DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_session_token (session_token);

-- 2. Create admins table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  session_token VARCHAR(64)  NULL DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_token (session_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Insert default admin (password: Admin@1234 — CHANGE THIS IMMEDIATELY)
INSERT IGNORE INTO admins (name, email, password)
VALUES (
  'ClassIQ Admin',
  'admin@classiq.app',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
);

-- 4. Add radius_m column to qr_sessions if not already present
ALTER TABLE qr_sessions
  ADD COLUMN IF NOT EXISTS radius_m INT NOT NULL DEFAULT 100;

-- 5. Ensure soft-delete columns exist on attendance
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS deleted_at      DATETIME     NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by      INT          NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(255) NULL DEFAULT NULL;

-- 6. Normalize old status values to new ones
UPDATE attendance SET status = 'Present' WHERE status = 'Normal';
UPDATE attendance SET status = 'Present' WHERE status = 'present';

-- 7. Make sure troubleshooting_logs has a subject column (optional)
ALTER TABLE troubleshooting_logs
  ADD COLUMN IF NOT EXISTS subject VARCHAR(255) NULL DEFAULT NULL AFTER user_id;

-- Done!
SELECT 'Migration complete.' AS result;
