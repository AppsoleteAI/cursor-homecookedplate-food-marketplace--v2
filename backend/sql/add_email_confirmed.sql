-- Show whether each account email is confirmed.
-- auth.users.email_confirmed_at is the source. profiles and the view below copy it
-- so the Table Editor can show the address and the confirmation time together.
-- A member cannot set this column. Every write is replaced from auth.users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

UPDATE public.profiles AS profile
SET email_confirmed_at = account.email_confirmed_at
FROM auth.users AS account
WHERE profile.id = account.id
  AND profile.email_confirmed_at IS DISTINCT FROM account.email_confirmed_at;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_confirmed boolean
  GENERATED ALWAYS AS (email_confirmed_at IS NOT NULL) STORED;

COMMENT ON COLUMN public.profiles.email_confirmed_at IS 'Copied from auth.users.email_confirmed_at. Null until the email is confirmed.';
COMMENT ON COLUMN public.profiles.email_confirmed IS 'True when email_confirmed_at is set.';

CREATE OR REPLACE FUNCTION public.copy_email_confirmed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  SELECT account.email_confirmed_at
  INTO NEW.email_confirmed_at
  FROM auth.users AS account
  WHERE account.id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copy_email_confirmed_at ON public.profiles;
CREATE TRIGGER copy_email_confirmed_at
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_email_confirmed_at();

CREATE OR REPLACE FUNCTION public.sync_profile_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email_confirmed_at = NEW.email_confirmed_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_email_confirmed ON auth.users;
CREATE TRIGGER sync_profile_email_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email_confirmed();

CREATE OR REPLACE VIEW public.user_email_confirmations AS
SELECT
  account.id,
  account.email,
  account.email_confirmed_at,
  (account.email_confirmed_at IS NOT NULL) AS email_confirmed,
  profile.username,
  profile.role,
  account.created_at AS signed_up_at
FROM auth.users AS account
LEFT JOIN public.profiles AS profile ON profile.id = account.id;

COMMENT ON VIEW public.user_email_confirmations IS 'Auth users with the email and whether that email is confirmed.';

REVOKE ALL ON public.user_email_confirmations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_email_confirmations TO service_role;
