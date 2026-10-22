ALTER TABLE [dbo].[kp_users] ADD [default_tab] nvarchar(40) COLLATE Latin1_General_100_BIN2 NULL;
INSERT INTO [dbo].[kp_schema_migrations]([version]) VALUES(45);
