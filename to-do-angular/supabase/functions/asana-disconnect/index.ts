import { createClient } from 'npm:@supabase/supabase-js@2';

const ASANA_BASE = 'https://app.asana.com/api/1.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get current profile to find webhook_gid and pat
    const { data: profile } = await adminClient
      .from('profiles')
      .select('asana_pat, asana_webhook_gid')
      .eq('id', user.id)
      .single();

    // Best-effort: delete webhook from Asana
    if (profile?.asana_webhook_gid && profile?.asana_pat) {
      await fetch(`${ASANA_BASE}/webhooks/${profile.asana_webhook_gid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${profile.asana_pat}` },
      });
    }

    // Clear all Asana fields from profile
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({
        asana_pat:                  null,
        asana_project_gid:          null,
        asana_workspace_gid:        null,
        asana_deleted_section_gid:  null,
        asana_webhook_gid:          null,
        asana_webhook_secret:       null,
        asana_priority_field_gid:   null,
        asana_priority_high_gid:    null,
        asana_priority_medium_gid:  null,
        asana_priority_low_gid:     null,
        asana_sync_enabled:         false,
      })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    return json({ success: true });
  } catch (err) {
    console.error('asana-disconnect error:', err);
    return json({ error: err?.message ?? 'Unknown error' }, 500);
  }
});
