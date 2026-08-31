-- ═══════════════════════════════════════════════════════════
-- RESTORE DEFAULT SUPABASE ROLE GRANTS
--
-- Symptom: every API call returns 42501 "permission denied for
-- table ..." → white page after sign-in, all syncs failing.
-- Cause: a script revoked table privileges from the API roles.
-- Supabase's model is: GRANT table access + RLS policies filter
-- rows. RLS stays enabled — this only restores the grants.
--
-- Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Make sure future tables get the grants automatically again
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
