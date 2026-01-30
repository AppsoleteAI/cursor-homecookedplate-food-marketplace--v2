-- Email Verification Tokens Table
-- Stores tokens for email confirmation flow (using production email service, not Supabase)
-- 
-- CRITICAL: Supabase emails are rate-limited and not suitable for production.
-- This table enables custom email confirmation using Resend or other production email services.

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON public.email_verification_tokens(expires_at);

-- Function to clean up expired tokens (can be called by a scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_email_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_verification_tokens
  WHERE expires_at < now() AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a trigger or scheduled job to auto-cleanup expired tokens
-- This can be set up in Supabase Dashboard > Database > Cron Jobs
