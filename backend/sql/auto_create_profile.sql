-- Trigger function to automatically create profile when user signs up
-- Location: backend/sql/auto_create_profile.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    new.id,
    -- Fallback: Use username from metadata, or the start of their email if missing
    COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
    new.email,
    -- Fallback: Use role from metadata (platemaker/platetaker), default to platetaker
    COALESCE(new.raw_user_meta_data->>'role', 'platetaker')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If the profile already exists, we just move on
    RETURN NEW;
  WHEN others THEN
    RAISE EXCEPTION 'Failed to create profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists to avoid error 42710
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to run when a new user is created in the auth schema
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Remove the redundant RLS policy
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
