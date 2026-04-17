import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!callerProfile?.is_admin) throw new Error('Forbidden');

    // Fetch all auth users
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // Fetch all profiles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('*');

    // Fetch task counts via RPC
    const { data: taskCounts } = await supabaseAdmin
      .rpc('get_task_counts_by_user');

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const taskMap = new Map((taskCounts ?? []).map((t: any) => [t.user_id, t]));

    const result = users.map((u: any) => {
      const profile = profileMap.get(u.id) ?? {};
      const tasks = taskMap.get(u.id) ?? { active_count: 0, completed_count: 0 };
      return {
        id: u.id,
        email: u.email ?? '',
        createdAt: u.created_at,
        isAdmin: profile.is_admin ?? false,
        isActive: profile.is_active ?? true,
        subscriptionStatus: profile.subscription_status ?? 'free',
        subscriptionEndDate: profile.subscription_end_date ?? null,
        stripeSubscriptionId: profile.stripe_subscription_id ?? null,
        activeTasks: Number(tasks.active_count),
        completedTasks: Number(tasks.completed_count),
      };
    });

    return new Response(JSON.stringify({ users: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
