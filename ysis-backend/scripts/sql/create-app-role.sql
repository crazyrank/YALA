-- Run ONCE in the Neon SQL editor as the owner role.
-- Replace the placeholders before running. Keep the owner login for migrations only.
--   REPLACE_WITH_LONG_RANDOM_PASSWORD  (at least 32 random characters)
--   neondb                              (your database name)

CREATE ROLE ysis_app LOGIN PASSWORD 'REPLACE_WITH_LONG_RANDOM_PASSWORD';

GRANT CONNECT ON DATABASE neondb TO ysis_app;
GRANT USAGE ON SCHEMA public TO ysis_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ysis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ysis_app;

-- Tables created later get the same grants automatically (migrations run as owner)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ysis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ysis_app;

-- The audit log is append-only for the app
REVOKE UPDATE, DELETE ON audit_logs FROM ysis_app;
