ALTER TABLE [kp_users] ADD COLUMN [default_tab] TEXT NULL CHECK([default_tab] IS NULL OR length([default_tab])<=40);
INSERT INTO [kp_schema_migrations]([version]) VALUES(45);
