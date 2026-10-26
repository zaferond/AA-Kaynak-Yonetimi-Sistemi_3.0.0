ALTER TABLE dbo.kp_projects ADD completed bit NOT NULL CONSTRAINT DF_kp_projects_completed DEFAULT 0;
INSERT INTO dbo.kp_schema_migrations(version) VALUES(47);
