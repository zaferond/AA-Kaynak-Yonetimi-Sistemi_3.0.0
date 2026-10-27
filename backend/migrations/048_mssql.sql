ALTER TABLE dbo.kp_users ADD employee_number nvarchar(512) NULL, employee_number_key varchar(64) NULL;
CREATE UNIQUE INDEX UX_kp_users_employee_number_key ON dbo.kp_users(employee_number_key) WHERE employee_number_key IS NOT NULL;
INSERT INTO dbo.kp_schema_migrations(version) VALUES(48);
