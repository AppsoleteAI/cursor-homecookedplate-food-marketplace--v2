// Supabase Edge Function: Notify when metro area cap is reached
// This function receives webhook payloads from database triggers
// and forwards them to Discord/Slack webhooks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    // Get webhook URL from environment variables
    const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');

    if (!discordWebhookUrl && !slackWebhookUrl) {
      console.error('[notify-cap-reached] No webhook URLs configured');
      return new Response(
        JSON.stringify({ error: 'Webhook URLs not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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

    // Format message for Discord/Slack
    const message = `🚨 **CAP REACHED** 🚨\n` +
      `Metro: ${payload.metro_name}\n` +
      `Type: ${payload.cap_type === 'platemakers' ? 'Platemakers' : 'Platetakers'} is now FULL (${payload.cap_type === 'platemakers' ? payload.platemaker_count : payload.platetaker_count}/100)\n` +
      `Timestamp: ${new Date(payload.timestamp).toISOString()}`;

    const promises: Promise<Response>[] = [];

    // Send to Discord if configured
    if (discordWebhookUrl) {
      promises.push(
        fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: message,
          }),
        })
      );
    }

    // Send to Slack if configured
    if (slackWebhookUrl) {
      promises.push(
        fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: message,
          }),
        })
      );
    }

    // Wait for all webhook calls to complete
    const results = await Promise.allSettled(promises);

    // Check if any failed
    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
    if (failures.length > 0) {
      console.error('[notify-cap-reached] Some webhooks failed:', failures);
    }

    // Log success
    console.log(`[notify-cap-reached] Notification sent for ${payload.metro_name}: ${payload.cap_type}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metro: payload.metro_name,
        cap_type: payload.cap_type,
        sent_to: {
          discord: !!discordWebhookUrl,
          slack: !!slackWebhookUrl,
        }
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
