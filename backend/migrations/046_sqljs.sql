ALTER TABLE kp_sessions ADD COLUMN last_activity_at TEXT NULL CHECK(last_activity_at IS NULL OR length(last_activity_at)<=30);
-- Existing sessions have no trustworthy activity timestamp; require a fresh login.
DELETE FROM kp_sessions;
INSERT INTO kp_schema_migrations(version) VALUES(46);
