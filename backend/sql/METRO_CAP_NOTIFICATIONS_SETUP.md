# Metro Cap Notifications Setup

This document explains how to set up automated notifications when metro area caps are reached.

## Overview

When a metro area reaches its cap (100 platemakers or 100 platetakers), the system automatically sends a notification to Discord or Slack via a Supabase Edge Function.

## Architecture

```
metro_area_counts UPDATE (count = 100)
  ↓
Database Trigger (notify_metro_cap_reached)
  ↓
Supabase Edge Function (notify-cap-reached)
  ↓
Discord/Slack Webhook
  ↓
Admin Notification
```

## Setup Steps

### 1. Deploy Supabase Edge Function

1. Install Supabase CLI (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy the Edge Function:
   ```bash
   supabase functions deploy notify-cap-reached
   ```

### 2. Configure Webhook URLs

Set environment variables in your Supabase project:

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Navigate to: Project Settings → Edge Functions → Secrets
3. Add the following secrets:
   - `DISCORD_WEBHOOK_URL` - Your Discord webhook URL (optional)
   - `SLACK_WEBHOOK_URL` - Your Slack webhook URL (optional)

   **Note**: At least one webhook URL must be configured.

#### Getting Discord Webhook URL

1. Go to your Discord server
2. Server Settings → Integrations → Webhooks
3. Create a new webhook or use an existing one
4. Copy the webhook URL

#### Getting Slack Webhook URL

1. Go to https://api.slack.com/apps
2. Create a new app or select an existing one
3. Go to "Incoming Webhooks" and activate it
4. Add a new webhook to your workspace
5. Copy the webhook URL

### 3. Run Database Migration

Run the trigger SQL in your Supabase SQL Editor:

```sql
-- Run: backend/sql/add_metro_cap_trigger.sql
```

This creates:
- `notify_metro_cap_reached()` function
- `metro_cap_reached_trigger` trigger on `metro_area_counts` table

### 4. Configure Database Settings (Optional)

For the trigger to call the Edge Function, you may need to set database settings:

```sql
-- Set Supabase URL (replace with your project URL)
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';

-- Set anon key for Edge Function authentication (optional, Edge Functions can use service role)
ALTER DATABASE postgres SET app.supabase_anon_key = 'your-anon-key';
```

**Note**: The trigger will attempt to construct the Edge Function URL automatically. If your database name follows Supabase's pattern, this may work without manual configuration.

### 5. Test the Setup

To test the notification system:

1. Manually update a metro count to 100:
   ```sql
   UPDATE metro_area_counts 
   SET maker_count = 100 
   WHERE metro_name = 'Test Metro';
   ```

2. Check your Discord/Slack channel for the notification

3. Check Supabase Edge Function logs:
   ```bash
   supabase functions logs notify-cap-reached
   ```

## Troubleshooting

### Notifications Not Sending

1. **Check Edge Function logs**:
   ```bash
   supabase functions logs notify-cap-reached
   ```

2. **Verify webhook URLs are set**:
   - Check Supabase Dashboard → Edge Functions → Secrets
   - Ensure at least one of `DISCORD_WEBHOOK_URL` or `SLACK_WEBHOOK_URL` is configured

3. **Check trigger is active**:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'metro_cap_reached_trigger';
   ```

4. **Test Edge Function manually**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/notify-cap-reached \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "metro_name": "Test Metro",
       "platemaker_count": 100,
       "platetaker_count": 50,
       "cap_type": "platemakers",
       "timestamp": "2024-01-01T00:00:00Z"
     }'
   ```

### Database Trigger Errors

If the trigger fails to call the Edge Function:

1. **Check pg_net extension is enabled**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. **Verify Edge Function URL construction**:
   - The trigger attempts to construct the URL from database settings
   - You may need to manually set `app.supabase_url` as shown in step 4

3. **Check network connectivity**:
   - Ensure your Supabase database can make outbound HTTP requests
   - Some Supabase plans may restrict this

## Security Notes

- Webhook URLs are stored as Supabase Edge Function secrets (encrypted)
- The trigger uses `SECURITY DEFINER` to bypass RLS for HTTP calls
- Edge Function validates payload structure before sending webhooks
- Failed webhook calls are logged but don't fail the database transaction

## Alternative: Direct Webhook from Trigger

If Edge Functions are not available, you can modify the trigger to call webhooks directly:

```sql
-- Replace Edge Function call with direct webhook call
SELECT * INTO http_response
FROM net.http_post(
  url := 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
  headers := jsonb_build_object('Content-Type', 'application/json'),
  body := webhook_payload::text
);
```

However, this requires storing webhook URLs in the database, which is less secure than using Edge Function secrets.
