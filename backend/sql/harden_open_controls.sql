-- Stops the buyer and the cook from changing money or identity on an order.
-- The live table uses platetaker_id / total_price_cents.
-- The repo schema uses buyer_id / total_price. This script locks whichever is present.
-- The service role still updates paid orders from the payment webhook.

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id uuid NOT NULL,
  shop text NOT NULL CHECK (shop IN ('farm', 'food_truck', 'catering', 'sit_down', 'meal_prep')),
  lines jsonb NOT NULL,
  base_amount numeric(10, 2) NOT NULL CHECK (base_amount >= 0),
  total_charge numeric(10, 2) NOT NULL CHECK (total_charge >= 0),
  payment_intent_id text,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_shop_orders" ON public.shop_orders;
CREATE POLICY "select_own_shop_orders" ON public.shop_orders
  FOR SELECT
  USING (buyer_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON TABLE public.shop_orders FROM authenticated, anon;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_price_cents'
  ) THEN
    EXECUTE 'REVOKE UPDATE ON TABLE public.orders FROM authenticated, anon';
    EXECUTE 'GRANT UPDATE (status, pickup_time, estimated_completion_time) ON TABLE public.orders TO authenticated';
    EXECUTE $live$
      CREATE OR REPLACE FUNCTION public.protect_order_columns()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        IF auth.role() = 'service_role' THEN
          RETURN new;
        END IF;
        IF to_jsonb(new) - 'status' - 'pickup_time' - 'estimated_completion_time' - 'updated_at'
           IS DISTINCT FROM
           to_jsonb(old) - 'status' - 'pickup_time' - 'estimated_completion_time' - 'updated_at'
        THEN
          RAISE EXCEPTION 'Buyer and cook cannot change order money or identity columns';
        END IF;
        RETURN new;
      END;
      $body$;
    $live$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'buyer_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_completion_time timestamptz';
    EXECUTE 'REVOKE UPDATE ON TABLE public.orders FROM authenticated, anon';
    EXECUTE 'GRANT UPDATE (status, special_instructions, cooking_temperature, allergies, delivery_address, pickup_time, payment_intent_id, estimated_completion_time, updated_at) ON TABLE public.orders TO authenticated';
    EXECUTE $repo$
      CREATE OR REPLACE FUNCTION public.protect_order_columns()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        IF auth.role() = 'service_role' OR public.is_admin() THEN
          RETURN new;
        END IF;
        IF new.id IS DISTINCT FROM old.id
           OR new.buyer_id IS DISTINCT FROM old.buyer_id
           OR new.seller_id IS DISTINCT FROM old.seller_id
           OR new.meal_id IS DISTINCT FROM old.meal_id
           OR new.quantity IS DISTINCT FROM old.quantity
           OR new.total_price IS DISTINCT FROM old.total_price
           OR new.paid IS DISTINCT FROM old.paid
           OR new.created_at IS DISTINCT FROM old.created_at
        THEN
          RAISE EXCEPTION 'Buyer and cook cannot change order money or identity columns';
        END IF;
        IF new.payment_intent_id IS DISTINCT FROM old.payment_intent_id THEN
          IF auth.uid() IS DISTINCT FROM old.buyer_id
             OR old.paid
             OR old.payment_intent_id IS NOT NULL
          THEN
            RAISE EXCEPTION 'Only the buyer can attach a payment once';
          END IF;
        END IF;
        RETURN new;
      END;
      $body$;
    $repo$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS protect_order_columns_trigger ON public.orders;
CREATE TRIGGER protect_order_columns_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_columns();
