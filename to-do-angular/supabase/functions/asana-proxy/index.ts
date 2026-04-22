import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface AsanaProfile {
  asana_pat: string;
  asana_project_gid: string;
  asana_deleted_section_gid: string;
  asana_priority_field_gid: string | null;
  asana_priority_high_gid: string | null;
  asana_priority_medium_gid: string | null;
  asana_priority_low_gid: string | null;
}

function buildCustomFields(
  priority: string,
  profile: AsanaProfile,
): Record<string, string> | undefined {
  if (!profile.asana_priority_field_gid) return undefined;
  const map: Record<string, string | null> = {
    none:   null,
    low:    profile.asana_priority_low_gid,
    medium: profile.asana_priority_medium_gid,
    high:   profile.asana_priority_high_gid,
    urgent: profile.asana_priority_high_gid, // urgent → High (best fit)
  };
  const val = map[priority] ?? null;
  if (!val) return undefined;
  return { [profile.asana_priority_field_gid]: val };
}

function toAsanaDate(iso: string | null): string | null {
  if (!iso) return null;
  return iso.split('T')[0]; // YYYY-MM-DD
}

async function asanaPut(url: string, body: unknown, pat: string) {
  return fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: body }),
  });
}

async function asanaPost(url: string, body: unknown, pat: string) {
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: body }),
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

    // Load user's Asana profile
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select(
        'asana_pat, asana_project_gid, asana_deleted_section_gid, asana_priority_field_gid, asana_priority_high_gid, asana_priority_medium_gid, asana_priority_low_gid',
      )
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.asana_pat) {
      return json({ error: 'Asana not connected' }, 400);
    }

    const p = profile as AsanaProfile;
    const body = await req.json();
    const { action } = body;

    // ─── createTask ────────────────────────────────────────────────────────────
    if (action === 'createTask') {
      const taskData: Record<string, unknown> = {
        name:     body.title ?? '',
        notes:    body.description ?? '',
        due_on:   toAsanaDate(body.dueDate),
        projects: [p.asana_project_gid],
      };
      const cf = buildCustomFields(body.priority ?? 'none', p);
      if (cf) taskData.custom_fields = cf;

      const res = await asanaPost(`${ASANA_BASE}/tasks`, taskData, p.asana_pat);
      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Asana createTask failed: ${err}` }, 400);
      }
      const { data: task } = await res.json();
      return json({ asana_gid: task.gid });
    }

    // ─── createSubtask ─────────────────────────────────────────────────────────
    if (action === 'createSubtask') {
      const taskData: Record<string, unknown> = {
        name:   body.title ?? '',
        notes:  body.description ?? '',
        due_on: toAsanaDate(body.dueDate),
      };
      const cf = buildCustomFields(body.priority ?? 'none', p);
      if (cf) taskData.custom_fields = cf;

      const res = await asanaPost(
        `${ASANA_BASE}/tasks/${body.parentAsanaGid}/subtasks`,
        taskData,
        p.asana_pat,
      );
      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Asana createSubtask failed: ${err}` }, 400);
      }
      const { data: task } = await res.json();
      return json({ asana_gid: task.gid });
    }

    // ─── updateTask ────────────────────────────────────────────────────────────
    if (action === 'updateTask') {
      const { asanaGid } = body;
      if (!asanaGid) return json({ error: 'asanaGid required' }, 400);

      const taskData: Record<string, unknown> = {};
      if ('title' in body)       taskData.name    = body.title;
      if ('description' in body) taskData.notes   = body.description;
      if ('dueDate' in body)     taskData.due_on  = toAsanaDate(body.dueDate);
      if ('priority' in body) {
        const cf = buildCustomFields(body.priority, p);
        if (cf) taskData.custom_fields = cf;
      }

      const res = await asanaPut(`${ASANA_BASE}/tasks/${asanaGid}`, taskData, p.asana_pat);
      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Asana updateTask failed: ${err}` }, 400);
      }
      return json({ success: true });
    }

    // ─── completeTask ──────────────────────────────────────────────────────────
    if (action === 'completeTask') {
      const { asanaGid } = body;
      if (!asanaGid) return json({ error: 'asanaGid required' }, 400);

      const res = await asanaPut(
        `${ASANA_BASE}/tasks/${asanaGid}`,
        { completed: true },
        p.asana_pat,
      );
      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Asana completeTask failed: ${err}` }, 400);
      }
      return json({ success: true });
    }

    // ─── restoreTask ───────────────────────────────────────────────────────────
    if (action === 'restoreTask') {
      const { asanaGid } = body;
      if (!asanaGid) return json({ error: 'asanaGid required' }, 400);

      // Mark incomplete
      await asanaPut(`${ASANA_BASE}/tasks/${asanaGid}`, { completed: false }, p.asana_pat);

      // Move back to the project (removes from Deleted section)
      await asanaPost(
        `${ASANA_BASE}/tasks/${asanaGid}/addProject`,
        { project: p.asana_project_gid },
        p.asana_pat,
      );

      return json({ success: true });
    }

    // ─── deleteTask ────────────────────────────────────────────────────────────
    if (action === 'deleteTask') {
      const { asanaGid } = body;
      if (!asanaGid) return json({ error: 'asanaGid required' }, 400);
      if (!p.asana_deleted_section_gid) return json({ error: 'Deleted section not configured' }, 400);

      // Move to Deleted section
      const res = await asanaPost(
        `${ASANA_BASE}/sections/${p.asana_deleted_section_gid}/addTask`,
        { task: asanaGid },
        p.asana_pat,
      );
      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Asana deleteTask failed: ${err}` }, 400);
      }
      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('asana-proxy error:', err);
    return json({ error: err?.message ?? 'Unknown error' }, 500);
  }
});
