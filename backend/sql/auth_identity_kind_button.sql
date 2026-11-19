-- Run after the Worker that reads apple and google is deployed.
-- Replaces only auth_identity_kind. A Google identity returns google.
-- An Apple identity returns apple. Both return apple_google.

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
        AND identity.provider = 'apple'
    ) AND EXISTS (
      SELECT 1
      FROM auth.users AS account
      JOIN auth.identities AS identity ON identity.user_id = account.id
      WHERE lower(account.email) = lower(target_email)
        AND identity.provider = 'google'
    ) THEN 'apple_google'
    WHEN EXISTS (
      SELECT 1
      FROM auth.users AS account
      JOIN auth.identities AS identity ON identity.user_id = account.id
      WHERE lower(account.email) = lower(target_email)
        AND identity.provider = 'google'
    ) THEN 'google'
    WHEN EXISTS (
      SELECT 1
      FROM auth.users AS account
      JOIN auth.identities AS identity ON identity.user_id = account.id
      WHERE lower(account.email) = lower(target_email)
        AND identity.provider = 'apple'
    ) THEN 'apple'
    ELSE 'email'
  END;
$$;

REVOKE ALL ON FUNCTION public.auth_identity_kind(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_identity_kind(text) TO service_role;
