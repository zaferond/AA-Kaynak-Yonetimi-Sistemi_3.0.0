ALTER TABLE [kp_projects] ADD COLUMN [completed] INTEGER NOT NULL DEFAULT 0 CHECK([completed] IN (0,1));
INSERT INTO [kp_schema_migrations]([version]) VALUES(47);
