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

async function runConnect(
  userId: string,
  pat: string,
  project_gid: string,
  existingWebhookGid: string | null,
  adminClient: ReturnType<typeof createClient>,
) {
  const ah = { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' };

  // 1. Validate PAT + get workspace
  const meRes = await fetch(`${ASANA_BASE}/users/me?opt_fields=workspaces`, { headers: ah });
  if (!meRes.ok) return json({ error: 'Invalid Asana PAT — please check and try again' }, 400);
  const { data: me } = await meRes.json();
  const workspace_gid: string = me.workspaces[0]?.gid;
  if (!workspace_gid) return json({ error: 'No Asana workspace found' }, 400);

  // 2. Find Priority custom field in workspace
  let priority_field_gid: string | null = null;
  let priority_high_gid: string | null = null;
  let priority_medium_gid: string | null = null;
  let priority_low_gid: string | null = null;

  const cfRes = await fetch(
    `${ASANA_BASE}/workspaces/${workspace_gid}/custom_fields?opt_fields=name,resource_subtype,enum_options`,
    { headers: ah },
  );
  if (cfRes.ok) {
    const { data: fields } = await cfRes.json();
    const priorityField = fields.find(
      (f: { name: string; resource_subtype: string }) =>
        f.name.toLowerCase() === 'priority' && f.resource_subtype === 'enum',
    );
    if (priorityField) {
      priority_field_gid = priorityField.gid;
      for (const opt of priorityField.enum_options ?? []) {
        const n = opt.name?.toLowerCase();
        if (n === 'high')   priority_high_gid   = opt.gid;
        if (n === 'medium') priority_medium_gid = opt.gid;
        if (n === 'low')    priority_low_gid    = opt.gid;
      }
      await fetch(`${ASANA_BASE}/projects/${project_gid}/addCustomFieldSetting`, {
        method: 'POST',
        headers: ah,
        body: JSON.stringify({ data: { custom_field: priority_field_gid } }),
      });
    }
  }

  // 3. Find or create "Deleted" section (idempotent — reuse if already exists)
  let deleted_section_gid: string | null = null;

  const sectionsRes = await fetch(
    `${ASANA_BASE}/projects/${project_gid}/sections?opt_fields=name`,
    { headers: ah },
  );
  if (sectionsRes.ok) {
    const { data: sections } = await sectionsRes.json();
    const existing = sections.find(
      (s: { name: string }) => s.name.toLowerCase() === 'deleted',
    );
    if (existing) {
      deleted_section_gid = existing.gid;
      console.log('asana-connect: reusing existing Deleted section', deleted_section_gid);
    }
  }

  if (!deleted_section_gid) {
    const secRes = await fetch(`${ASANA_BASE}/projects/${project_gid}/sections`, {
      method: 'POST',
      headers: ah,
      body: JSON.stringify({ data: { name: 'Deleted' } }),
    });
    if (secRes.ok) {
      const { data: section } = await secRes.json();
      deleted_section_gid = section.gid;
      console.log('asana-connect: created Deleted section', deleted_section_gid);
    } else {
      console.warn('asana-connect: could not create Deleted section');
    }
  }

  // 4. Delete old webhook if one exists (prevents stale webhooks)
  if (existingWebhookGid) {
    console.log('asana-connect: deleting old webhook', existingWebhookGid);
    await fetch(`${ASANA_BASE}/webhooks/${existingWebhookGid}`, {
      method: 'DELETE',
      headers: ah,
    });
  }

  // 5. Register fresh webhook — handshake will be handled by asana-webhook function
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const webhookTarget = `${supabaseUrl}/functions/v1/asana-webhook?uid=${userId}`;

  const whRes = await fetch(`${ASANA_BASE}/webhooks`, {
    method: 'POST',
    headers: ah,
    body: JSON.stringify({
      data: {
        resource: project_gid,
        target: webhookTarget,
        filters: [
          { resource_type: 'task', action: 'changed' },
          { resource_type: 'task', action: 'added' },
          { resource_type: 'task', action: 'removed' },
          { resource_type: 'task', action: 'deleted' },
        ],
      },
    }),
  });

  let webhook_gid: string | null = null;
  if (whRes.ok) {
    const { data: wh } = await whRes.json();
    webhook_gid = wh?.gid ?? null;
    console.log('asana-connect: registered webhook', webhook_gid);
  } else {
    const errText = await whRes.text();
    console.warn('asana-connect: webhook registration failed', errText);
  }

  // 6. Persist to profile — clear old secret so new handshake stores fresh one
  const { error: updateErr } = await adminClient
    .from('profiles')
    .update({
      asana_pat:                  pat,
      asana_project_gid:          project_gid,
      asana_workspace_gid:        workspace_gid,
      asana_deleted_section_gid:  deleted_section_gid,
      asana_webhook_gid:          webhook_gid,
      asana_webhook_secret:       null, // cleared so new handshake can write fresh secret
      asana_priority_field_gid:   priority_field_gid,
      asana_priority_high_gid:    priority_high_gid,
      asana_priority_medium_gid:  priority_medium_gid,
      asana_priority_low_gid:     priority_low_gid,
      asana_sync_enabled:         true,
    })
    .eq('id', userId);

  if (updateErr) throw updateErr;

  return json({ success: true });
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

    const body = await req.json();

    // ─── Reconnect mode: reuse stored PAT + project_gid ────────────────────
    if (body.reconnect === true) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('asana_pat, asana_project_gid, asana_webhook_gid')
        .eq('id', user.id)
        .single();

      if (!profile?.asana_pat || !profile?.asana_project_gid) {
        return json({ error: 'Not connected — please connect first' }, 400);
      }

      console.log('asana-connect: reconnect mode for user', user.id);
      return await runConnect(
        user.id,
        profile.asana_pat,
        profile.asana_project_gid,
        profile.asana_webhook_gid ?? null,
        adminClient,
      );
    }

    // ─── Normal connect mode ────────────────────────────────────────────────
    const { pat, project_gid } = body;
    if (!pat || !project_gid) return json({ error: 'pat and project_gid are required' }, 400);

    // Load any existing webhook_gid so we can clean it up
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('asana_webhook_gid')
      .eq('id', user.id)
      .single();

    return await runConnect(
      user.id,
      pat,
      project_gid,
      existingProfile?.asana_webhook_gid ?? null,
      adminClient,
    );
  } catch (err) {
    console.error('asana-connect error:', err);
    return json({ error: err?.message ?? 'Unknown error' }, 500);
  }
});
