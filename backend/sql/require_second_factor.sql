-- Rejects a signed-in token that has not finished Supabase's second factor.
-- An account with no verified factor keeps a normal session.
-- Run this once in the Supabase SQL editor after protect_membership_columns.sql
-- and auto_create_profile.sql. Running it again replaces the function and the policies.

CREATE OR REPLACE FUNCTION public.session_completed_second_factor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    COALESCE(auth.jwt()->>'aal', '') = 'aal2'
    OR NOT EXISTS (
      SELECT 1
      FROM auth.mfa_factors
      WHERE user_id = auth.uid()
        AND status = 'verified'
    );
$$;

REVOKE ALL ON FUNCTION public.session_completed_second_factor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.session_completed_second_factor() TO anon, authenticated, service_role;

-- Names the Apple or Google identity behind an email. The Worker calls this.
-- Anon and authenticated cannot call it.
CREATE OR REPLACE FUNCTION public.auth_identity_kind(target_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM auth.users
      WHERE lower(email) = lower(target_email)
    ) THEN 'none'
    WHEN EXISTS (
      SELECT 1
      FROM auth.users AS account
      JOIN auth.identities AS identity ON identity.user_id = account.id
      WHERE lower(account.email) = lower(target_email)
        AND identity.provider IN ('apple', 'google')
    ) THEN 'provider'
    ELSE 'email'
  END;
$$;

REVOKE ALL ON FUNCTION public.auth_identity_kind(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_identity_kind(text) TO service_role;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS session_completed_second_factor ON %I.%I',
      target.schema_name,
      target.table_name
    );
    EXECUTE format(
      'CREATE POLICY session_completed_second_factor ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.session_completed_second_factor()) WITH CHECK (public.session_completed_second_factor())',
      target.schema_name,
      target.table_name
    );
  END LOOP;
END $$;
