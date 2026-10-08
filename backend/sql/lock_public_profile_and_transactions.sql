-- Run in the Supabase SQL editor before a public launch.
-- Stops the anon key from reading every profile (including Stripe ids)
-- and stops signed-in users from writing ledger rows.
-- The API loads cook names with the service role, which bypasses these policies.

DROP POLICY IF EXISTS "select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "select_other_profiles_limited" ON public.profiles;
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;

CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid() OR public.is_admin() = true);

DROP POLICY IF EXISTS "service_role_can_insert_transactions" ON public.transactions;
DROP POLICY IF EXISTS "service_role_can_update_transactions" ON public.transactions;

-- No INSERT/UPDATE policy for authenticated users.
-- The service role bypasses RLS and remains the only writer.
