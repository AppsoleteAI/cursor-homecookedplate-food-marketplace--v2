-- Keep the time zone the buyer chose with the pickup instant.
-- Run this in the Supabase SQL editor.

alter table public.orders add column if not exists pickup_timezone text;
