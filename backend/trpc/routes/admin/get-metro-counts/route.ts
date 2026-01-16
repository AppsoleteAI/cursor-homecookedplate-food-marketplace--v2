import { adminProcedure } from "../../../create-context";
import { supabaseAdmin } from "../../../../lib/supabase";

export const getMetroCountsProcedure = adminProcedure
  .query(async () => {
    // Query all metro area counts using admin client to bypass RLS
    const { data: counts, error } = await supabaseAdmin
      .from('metro_area_counts')
      .select('metro_name, maker_count, taker_count')
      .order('metro_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch metro counts: ${error.message}`);
    }

    // Transform to match component expectations
    return (counts || []).map(metro => ({
      name: metro.metro_name,
      maker_count: metro.maker_count,
      taker_count: metro.taker_count,
    }));
  });
