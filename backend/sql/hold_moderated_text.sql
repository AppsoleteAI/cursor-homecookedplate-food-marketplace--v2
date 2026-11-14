-- Held review comments and plate notes are not readable with the anon key.
-- A signed-in account cannot release its own comment, delete an order,
-- or skip the paid pickup steps.
-- The Worker still reads those columns with the service role.
-- Run this once in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.hold_review_comment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  row_new jsonb := to_jsonb(NEW);
  row_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  comment_text text := btrim(COALESCE(row_new->>'comment', ''));
  prior_comment text := btrim(COALESCE(row_old->>'comment', ''));
BEGIN
  IF auth.role() = 'service_role' OR NOT (row_new ? 'comment_status') THEN
    RETURN NEW;
  END IF;
  IF comment_text = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR comment_text IS DISTINCT FROM prior_comment THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('comment_status', 'pending'));
    RETURN NEW;
  END IF;
  IF row_new->>'comment_status' IS DISTINCT FROM row_old->>'comment_status' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('comment_status', row_old->>'comment_status'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hold_review_comment ON public.reviews;
CREATE TRIGGER hold_review_comment
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.hold_review_comment();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'comment'
  ) THEN
    EXECUTE 'REVOKE SELECT (comment) ON TABLE public.reviews FROM anon, authenticated';
    EXECUTE 'REVOKE UPDATE (comment) ON TABLE public.reviews FROM anon, authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'comment_status'
  ) THEN
    EXECUTE 'REVOKE SELECT (comment_status) ON TABLE public.reviews FROM anon, authenticated';
    EXECUTE 'REVOKE UPDATE (comment_status) ON TABLE public.reviews FROM anon, authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'special_instructions'
  ) THEN
    EXECUTE 'REVOKE SELECT (special_instructions) ON TABLE public.orders FROM anon, authenticated';
    EXECUTE 'REVOKE UPDATE (special_instructions) ON TABLE public.orders FROM anon, authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'instructions_status'
  ) THEN
    EXECUTE 'REVOKE SELECT (instructions_status) ON TABLE public.orders FROM anon, authenticated';
    EXECUTE 'REVOKE UPDATE (instructions_status) ON TABLE public.orders FROM anon, authenticated';
  END IF;
END $$;

REVOKE DELETE ON TABLE public.orders FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_row jsonb := to_jsonb(OLD);
  actor uuid := auth.uid();
  buyer uuid;
  cook uuid;
  actor_role text;
  paid_ok boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' AND auth.role() IS DISTINCT FROM 'anon' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF COALESCE(old_row->>'buyer_id', '') <> '' THEN
    buyer := (old_row->>'buyer_id')::uuid;
  ELSIF COALESCE(old_row->>'platetaker_id', '') <> '' THEN
    buyer := (old_row->>'platetaker_id')::uuid;
  END IF;
  IF COALESCE(old_row->>'seller_id', '') <> '' THEN
    cook := (old_row->>'seller_id')::uuid;
  ELSIF COALESCE(old_row->>'platemaker_id', '') <> '' THEN
    cook := (old_row->>'platemaker_id')::uuid;
  END IF;

  IF actor IS NOT NULL AND actor = cook THEN
    actor_role := 'seller';
  ELSIF actor IS NOT NULL AND actor = buyer THEN
    actor_role := 'buyer';
  ELSE
    RAISE EXCEPTION 'That order step is not available';
  END IF;

  IF NOT (
    (actor_role = 'seller' AND OLD.status = 'pending' AND NEW.status = 'accepted')
    OR (actor_role = 'seller' AND OLD.status IN ('accepted', 'preparing') AND NEW.status = 'ready')
    OR (actor_role IN ('seller', 'buyer') AND OLD.status = 'ready' AND NEW.status = 'completed')
    OR (actor_role = 'buyer' AND OLD.status = 'pending' AND NEW.status = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'That order step is not available';
  END IF;

  IF NEW.status IN ('accepted', 'ready', 'completed') THEN
    IF old_row ? 'paid' AND COALESCE((old_row->>'paid')::boolean, false) THEN
      paid_ok := true;
    ELSE
      BEGIN
        IF EXISTS (
          SELECT 1 FROM public.transactions
          WHERE order_id = OLD.id AND status IN ('held', 'settled')
        ) THEN
          paid_ok := true;
        END IF;
      EXCEPTION
        WHEN undefined_table OR undefined_column THEN
          paid_ok := false;
      END;
    END IF;
    IF NOT paid_ok THEN
      RAISE EXCEPTION 'Stripe has not confirmed this payment';
    END IF;
  END IF;

  IF NEW.status = 'completed' AND (
    NOT EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE action = 'PICKUP_CONFIRM'
        AND record_id::text = OLD.id::text
        AND new_data->>'role' = 'buyer'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE action = 'PICKUP_CONFIRM'
        AND record_id::text = OLD.id::text
        AND new_data->>'role' = 'seller'
    )
  ) THEN
    RAISE EXCEPTION 'Both people have to acknowledge that the food was paid for and received';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_order_status ON public.orders;
CREATE TRIGGER guard_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_status();
