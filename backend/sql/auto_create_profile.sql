-- Trigger function to automatically create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $
begin
  insert into public.profiles (id, username, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    'platetaker'
  );
  return new;
exception
  when unique_violation then
    raise exception 'Username or email already exists';
  when others then
    raise exception 'Failed to create profile: %', sqlerrm;
end;
$ language plpgsql security definer;

-- Drop the trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger to run when a new user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Remove the dangerous RLS policy - triggers with SECURITY DEFINER bypass RLS
-- Users should never directly insert into profiles
drop policy if exists "insert_own_profile" on public.profiles;
