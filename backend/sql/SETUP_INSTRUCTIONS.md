# Supabase Setup Instructions

This document provides step-by-step instructions for setting up your Supabase backend.

## Prerequisites

1. A Supabase account at [https://supabase.com](https://supabase.com)
2. Your project's Supabase URL and anon key (already configured in `.env`)

## Setup Steps

### 1. Run Database Schema

Execute the schema SQL to create all tables:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy and paste the entire contents of `backend/sql/schema.sql`
5. Click **Run** to execute

This will create:
- `profiles` table (user accounts)
- `meals` table (meal listings)
- `orders` table (order transactions)
- `reviews` table (meal reviews)
- `order_messages` table (buyer-seller messaging)
- `notifications` table (user notifications)
- `media_attachments` table (meal photos/videos)
- `promotional_offers` table (discounts and promotions)
- `favorites` table (user favorites)

### 2. Enable Row Level Security (RLS)

Execute the RLS policies:

1. In the **SQL Editor**, create a new query
2. Copy and paste the entire contents of `backend/sql/rls_policies.sql`
3. Click **Run** to execute

This will:
- Enable RLS on all tables
- Create security policies for data access control
- Ensure users can only access their own data and public data

### 3. Set Up Storage Buckets

Execute the storage configuration:

1. In the **SQL Editor**, create a new query
2. Copy and paste the entire contents of `backend/sql/storage.sql`
3. Click **Run** to execute

This will create:
- `meal-media` bucket for meal photos and videos (max 50MB per file)
- `profile-images` bucket for user profile pictures (max 5MB per file)
- Storage policies for secure upload/access

### 4. Verify Setup

Test your connection:

```bash
# The app should now connect to Supabase
# Try signing up a new user through the app
```

## Security Features

✅ **No API Keys in Client Code**: The `.env` file only contains the public anon key, which is safe to use in client-side code.

✅ **Row Level Security**: All tables have RLS policies that restrict data access:
- Users can only read/update their own profiles
- Users can only create orders for themselves
- Users can only view orders they're involved in
- Reviews can only be written by users who completed an order

✅ **Storage Security**: Media files are organized by user ID and protected:
- Users can only upload to their own folders
- Public read access for displaying content
- File size limits prevent abuse

✅ **Authentication**: Supabase handles secure authentication:
- Password hashing
- JWT tokens
- Secure session management

## Data Organization

The database is organized with user-based access control:

```
Users (profiles)
├── Meals (created by PlateMakers)
│   ├── Media Attachments
│   ├── Reviews
│   └── Promotional Offers
├── Orders (buyer and seller access)
│   └── Order Messages
├── Notifications
└── Favorites
```

## Troubleshooting

### Error: "relation does not exist"
- Ensure you ran `schema.sql` first

### Error: "permission denied"
- Ensure you ran `rls_policies.sql` after the schema
- Check that you're authenticated when making requests

### Storage upload fails
- Ensure you ran `storage.sql`
- Check file size limits (50MB for meals, 5MB for profiles)
- Verify file types are allowed (images: jpeg, png, webp; videos: mp4, quicktime)

## Next Steps

The backend is now ready! The app will:
1. Store all user data securely in Supabase
2. Handle authentication via Supabase Auth
3. Upload media to Supabase Storage
4. Enforce role-based access control
5. Protect sensitive data with RLS policies

All API secret keys remain server-side and are never exposed to the client.
