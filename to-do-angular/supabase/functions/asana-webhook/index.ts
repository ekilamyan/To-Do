import { createClient } from 'npm:@supabase/supabase-js@2';

const ASANA_BASE = 'https://app.asana.com/api/1.0';

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(computed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex === signature;
  } catch {
    return false;
  }
}

function asanaPriorityToApp(
  customFields: { gid: string; enum_value?: { gid: string } }[],
  priorityFieldGid: string | null,
  highGid: string | null,
  mediumGid: string | null,
  lowGid: string | null,
): string {
  if (!priorityFieldGid) return 'none';
  const field = customFields.find((f) => f.gid === priorityFieldGid);
  const val = field?.enum_value?.gid ?? null;
  if (val === highGid)   return 'high';
  if (val === mediumGid) return 'medium';
  if (val === lowGid)    return 'low';
  return 'none';
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('uid');
  if (!userId) return new Response('Missing uid', { status: 400 });

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ─── Asana handshake ──────────────────────────────────────────────────────
  const hookSecret = req.headers.get('X-Hook-Secret');
  if (hookSecret) {
    console.log('asana-webhook: handshake received for user', userId);
    await adminClient
      .from('profiles')
      .update({ asana_webhook_secret: hookSecret })
      .eq('id', userId);
    console.log('asana-webhook: handshake secret stored');
    return new Response('ok', {
      status: 200,
      headers: { 'X-Hook-Secret': hookSecret, 'Content-Type': 'text/plain' },
    });
  }

  // ─── Normal event ─────────────────────────────────────────────────────────
  const rawBody = await req.text();
  const signature = req.headers.get('X-Hook-Signature') ?? '';

  const { data: profile } = await adminClient
    .from('profiles')
    .select(
      'asana_pat, asana_webhook_secret, asana_deleted_section_gid, asana_priority_field_gid, asana_priority_high_gid, asana_priority_medium_gid, asana_priority_low_gid',
    )
    .eq('id', userId)
    .single();

  if (!profile?.asana_webhook_secret || !profile?.asana_pat) {
    console.warn('asana-webhook: no secret/PAT for user', userId, '— returning 200 to suppress Asana retries');
    return new Response('Not configured', { status: 200 });
  }

  const valid = await verifySignature(profile.asana_webhook_secret, rawBody, signature);
  if (!valid) {
    console.warn('asana-webhook: invalid HMAC signature for user', userId);
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: { events: unknown[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log('asana-webhook: received', (payload.events ?? []).length, 'events for user', userId);

  const ah = {
    Authorization: `Bearer ${profile.asana_pat}`,
    'Content-Type': 'application/json',
  };

  const processedGids = new Set<string>();

  for (const event of payload.events ?? []) {
    const ev = event as {
      action: string;
      resource: { gid: string; resource_type: string };
      parent?: { gid: string; resource_type: string };
      change?: { field: string };
    };

    if (ev.resource?.resource_type !== 'task') continue;
    const taskGid = ev.resource.gid;
    if (processedGids.has(taskGid)) continue;
    processedGids.add(taskGid);

    console.log('asana-webhook: processing task', taskGid, 'action', ev.action);

    const taskRes = await fetch(
      `${ASANA_BASE}/tasks/${taskGid}?opt_fields=name,notes,completed,due_on,custom_fields,modified_at,parent,memberships.section.gid`,
      { headers: ah },
    );
    if (!taskRes.ok) {
      console.warn('asana-webhook: could not fetch task', taskGid, taskRes.status);
      continue;
    }
    const { data: asanaTask } = await taskRes.json();

    const { data: dbTask } = await adminClient
      .from('tasks')
      .select('id, updated_at, status')
      .eq('asana_gid', taskGid)
      .eq('user_id', userId)
      .single();

    if (!dbTask) {
      console.log('asana-webhook: task', taskGid, 'not found in app DB — skipping');
      continue;
    }

    // Last-write-wins
    const asanaModified = new Date(asanaTask.modified_at).getTime();
    const ourUpdated    = new Date(dbTask.updated_at).getTime();
    if (ourUpdated > asanaModified) {
      console.log('asana-webhook: our record is newer — skipping task', taskGid);
      continue;
    }

    const inDeletedSection = (asanaTask.memberships ?? []).some(
      (m: { section?: { gid: string } }) =>
        m.section?.gid === profile.asana_deleted_section_gid,
    );

    let newStatus = dbTask.status;
    if (inDeletedSection) {
      newStatus = 'deleted';
    } else if (asanaTask.completed) {
      newStatus = 'completed';
    } else {
      newStatus = 'active';
    }

    const priority = asanaPriorityToApp(
      asanaTask.custom_fields ?? [],
      profile.asana_priority_field_gid,
      profile.asana_priority_high_gid,
      profile.asana_priority_medium_gid,
      profile.asana_priority_low_gid,
    );

    const updates: Record<string, unknown> = {
      title:        asanaTask.name ?? '',
      description:  asanaTask.notes ?? '',
      priority,
      due_date:     asanaTask.due_on ? new Date(asanaTask.due_on).toISOString() : null,
      status:       newStatus,
      completed_at: asanaTask.completed ? new Date().toISOString() : null,
    };

    console.log('asana-webhook: updating task', dbTask.id, '→ status:', newStatus);

    await adminClient
      .from('tasks')
      .update(updates)
      .eq('id', dbTask.id)
      .eq('user_id', userId);
  }

  return new Response('ok', { status: 200 });
});
