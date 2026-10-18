-- Trigger function to automatically create profile when user signs up
-- Location: backend/sql/auto_create_profile.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_role text;
BEGIN
  chosen_role := COALESCE(NEW.raw_user_meta_data->>'role', 'platetaker');
  IF chosen_role NOT IN ('platemaker', 'platetaker') THEN
    chosen_role := 'platetaker';
  END IF;

  INSERT INTO public.profiles (id, username, email, role, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), SPLIT_PART(COALESCE(NEW.email, 'member'), '@', 1)),
    COALESCE(NEW.email, NEW.id::text || '@users.local'),
    chosen_role,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- A profile copy must not roll back the auth user. Signup finishes the profile with the service role.
    RAISE LOG 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop the trigger if it exists to avoid error 42710
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to run when a new user is created in the auth schema
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Remove the redundant RLS policy
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
