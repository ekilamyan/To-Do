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

    const { pat } = await req.json();
    if (!pat) return json({ error: 'pat is required' }, 400);

    const ah = { Authorization: `Bearer ${pat}` };

    // Get workspaces
    const wsRes = await fetch(`${ASANA_BASE}/workspaces?opt_fields=name`, { headers: ah });
    if (!wsRes.ok) return json({ error: 'Invalid Asana PAT' }, 400);
    const { data: workspaces } = await wsRes.json();

    // Get projects for each workspace (in parallel)
    const results = await Promise.all(
      workspaces.map(async (ws: { gid: string; name: string }) => {
        const prRes = await fetch(
          `${ASANA_BASE}/projects?workspace=${ws.gid}&opt_fields=name&archived=false`,
          { headers: ah },
        );
        if (!prRes.ok) return [];
        const { data: projects } = await prRes.json();
        return projects.map((p: { gid: string; name: string }) => ({
          gid: p.gid,
          name: p.name,
          workspace: ws.name,
        }));
      }),
    );

    const projects = results.flat();
    return json({ projects });
  } catch (err) {
    console.error('asana-get-projects error:', err);
    return json({ error: err?.message ?? 'Unknown error' }, 500);
  }
});
