// Supabase Edge Function: Notify when metro area cap is reached
// This function receives webhook payloads from database triggers
// and logs them to admin_system_alerts table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

interface MetroCapPayload {
  metro_name: string;
  platemaker_count: number;
  platetaker_count: number;
  cap_type: 'platemakers' | 'platetakers';
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase credentials from environment (Service Role Key for admin access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[notify-cap-reached] Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const payload: MetroCapPayload = await req.json();

    // Validate payload structure
    if (!payload.metro_name || !payload.cap_type) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log to admin_system_alerts table (Security Standards: Log critical system events)
    // Use City Max Alert branding for consistency with backend utility
    const count = payload.cap_type === 'platemakers' ? payload.platemaker_count : payload.platetaker_count;
    const roleLabel = payload.cap_type === 'platemakers' ? 'Platemakers' : 'Platetakers';
    const alertMessage = `${roleLabel} cap reached for ${payload.metro_name} (${count}/100)`;
    
    const { error: alertError } = await supabase
      .from('admin_system_alerts')
      .insert({
        alert_type: 'metro_cap_reached',
        severity: 'high',
        title: `City Max Alert: ${payload.metro_name}`,
        message: `🚨 City Max Alert: ${alertMessage}`,
        metadata: {
          metro_name: payload.metro_name,
          cap_type: payload.cap_type,
          platemaker_count: payload.platemaker_count,
          platetaker_count: payload.platetaker_count,
          timestamp: payload.timestamp,
        },
      });

    if (alertError) {
      console.error('[notify-cap-reached] Failed to log to admin_system_alerts:', alertError);
      // Continue anyway - alert was received
    } else {
      console.log(`[notify-cap-reached] Alert logged to admin_system_alerts for ${payload.metro_name}: ${payload.cap_type}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        metro: payload.metro_name,
        cap_type: payload.cap_type,
        logged: true,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[notify-cap-reached] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
