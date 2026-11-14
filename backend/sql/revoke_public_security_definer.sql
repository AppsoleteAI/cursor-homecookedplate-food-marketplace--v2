-- Stop the public key and a signed-in session from calling these functions directly.
-- Triggers still fire. The Worker calls the ones it needs with the service role.
-- is_admin() and session_completed_second_factor() stay callable where row policies use them.
-- st_estimatedextent belongs to PostGIS. This script does not change it.

DO $$
DECLARE
  r record;
  lock_names text[] := ARRAY[
    'promote_to_admin',
    'protect_apple_subscription',
    'protect_google_subscription',
    'protect_membership_columns',
    'protect_order_columns',
    'protect_reserved_identifier',
    'protect_selling_removed',
    'protect_stripe_identity_claim',
    'reset_lifetime_device',
    'rls_auto_enable',
    'sync_profile_email_confirmed',
    'calculate_order_price',
    'check_hardware_integrity',
    'cleanup_old_login_attempts',
    'copy_email_confirmed_at',
    'guard_order_status',
    'handle_new_user',
    'increment_metro_count',
    'auth_identity_kind'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (lock_names)
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
      RAISE NOTICE 'locked %', r.sig;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped %', r.sig;
    END;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.session_completed_second_factor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_completed_second_factor() TO authenticated, service_role;
