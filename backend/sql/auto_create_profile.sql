-- Trigger function to automatically create profile when user signs up
-- Location: backend/sql/auto_create_profile.sql
-- Apple and Google do not send a role. This trigger does not guess PlateTaker.
-- The app finishes that profile after the person chooses Order a Plate or Start Cooking.
-- A taken username gets a suffix. The auth user is not left without a profile for that reason.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_role text;
  base_name text;
  candidate text;
  suffix integer := 0;
BEGIN
  chosen_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
  IF chosen_role IS NULL OR chosen_role NOT IN ('platemaker', 'platetaker') THEN
    RETURN NEW;
  END IF;

  base_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), SPLIT_PART(COALESCE(NEW.email, 'member'), '@', 1));
  base_name := lower(regexp_replace(base_name, '[^a-zA-Z0-9_]', '', 'g'));
  IF length(base_name) < 3 THEN
    base_name := 'member' || left(replace(NEW.id::text, '-', ''), 6);
  END IF;
  base_name := left(base_name, 24);
  candidate := base_name;

  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, email, role, is_admin)
      VALUES (
        NEW.id,
        candidate,
        COALESCE(NEW.email, NEW.id::text || '@users.local'),
        chosen_role,
        false
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    EXCEPTION
      WHEN unique_violation THEN
        IF SQLERRM ILIKE '%username%' AND suffix < 30 THEN
          suffix := suffix + 1;
          IF suffix = 30 THEN
            candidate := left(base_name, 12) || left(replace(NEW.id::text, '-', ''), 8);
          ELSE
            candidate := left(base_name, 20) || suffix::text;
          END IF;
        ELSE
          RAISE LOG 'handle_new_user left % without a profile: %', NEW.id, SQLERRM;
          RETURN NEW;
        END IF;
    END;
  END LOOP;
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
