-- Stop metro signup counts from passing max_cap.
-- The previous function incremented first, then returned CAP_REACHED,
-- so a full metro could still grow. Run this in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.increment_metro_count(
  metro_name_param text,
  user_role text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  metro_max_cap integer;
BEGIN
  SELECT
    CASE
      WHEN user_role = 'platemaker' THEN platemaker_count
      WHEN user_role = 'platetaker' THEN platetaker_count
      ELSE NULL
    END,
    max_cap
  INTO current_count, metro_max_cap
  FROM public.metro_area_counts
  WHERE metro_name = metro_name_param
  FOR UPDATE;

  IF user_role NOT IN ('platemaker', 'platetaker') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be platemaker or platetaker', user_role;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.metro_area_counts (metro_name, platemaker_count, platetaker_count)
    VALUES (metro_name_param, 0, 0)
    ON CONFLICT (metro_name) DO NOTHING;

    SELECT
      CASE
        WHEN user_role = 'platemaker' THEN platemaker_count
        ELSE platetaker_count
      END,
      max_cap
    INTO current_count, metro_max_cap
    FROM public.metro_area_counts
    WHERE metro_name = metro_name_param
    FOR UPDATE;
  END IF;

  IF metro_max_cap IS NULL THEN
    metro_max_cap := 100;
  END IF;

  IF current_count >= metro_max_cap THEN
    RETURN 'CAP_REACHED';
  END IF;

  IF user_role = 'platemaker' THEN
    UPDATE public.metro_area_counts
    SET platemaker_count = platemaker_count + 1, updated_at = now()
    WHERE metro_name = metro_name_param;
  ELSE
    UPDATE public.metro_area_counts
    SET platetaker_count = platetaker_count + 1, updated_at = now()
    WHERE metro_name = metro_name_param;
  END IF;

  RETURN 'SUCCESS';
END;
$$;
