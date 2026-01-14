-- Create storage buckets for media uploads

-- Meal images and videos bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-media',
  'meal-media',
  true,
  52428800, -- 50MB
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
) on conflict (id) do nothing;

-- Profile images bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Storage policies for meal-media bucket

-- Allow authenticated users to upload to their own folder
create policy "Users can upload meal media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'meal-media' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own meal media
create policy "Users can update own meal media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'meal-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own meal media
create policy "Users can delete own meal media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'meal-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all meal media
create policy "Public can view meal media"
on storage.objects for select
to public
using (bucket_id = 'meal-media');

-- Storage policies for profile-images bucket

-- Allow authenticated users to upload to their own folder
create policy "Users can upload profile images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own profile images
create policy "Users can update own profile images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own profile images
create policy "Users can delete own profile images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all profile images
create policy "Public can view profile images"
on storage.objects for select
to public
using (bucket_id = 'profile-images');
