ALTER TABLE dbo.kp_sessions ADD last_activity_at varchar(30) COLLATE Latin1_General_100_BIN2 NULL;
-- Existing sessions have no trustworthy activity timestamp; require a fresh login.
DELETE FROM dbo.kp_sessions;
INSERT INTO dbo.kp_schema_migrations(version) VALUES(46);
