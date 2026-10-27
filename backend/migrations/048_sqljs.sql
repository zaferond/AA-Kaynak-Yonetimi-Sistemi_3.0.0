ALTER TABLE [kp_users] ADD COLUMN [employee_number] TEXT NULL;
ALTER TABLE [kp_users] ADD COLUMN [employee_number_key] TEXT NULL;
CREATE UNIQUE INDEX [UX_kp_users_employee_number_key] ON [kp_users]([employee_number_key]) WHERE [employee_number_key] IS NOT NULL;
INSERT INTO [kp_schema_migrations]([version]) VALUES(48);
