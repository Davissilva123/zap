import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Admin client (service role) — pode criar usuários
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verifica que o chamador é o super admin autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    const superAdminEmail = Deno.env.get('SUPER_ADMIN_EMAIL') ?? 'sdavi6790@gmail.com';
    if (user.email?.toLowerCase() !== superAdminEmail.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Apenas o super admin pode criar membros da equipe' }), { status: 403, headers: corsHeaders });
    }

    const { email, password, name, role } = await req.json();
    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: 'email, password, name e role são obrigatórios' }), { status: 400, headers: corsHeaders });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }), { status: 400, headers: corsHeaders });
    }

    // Cria o usuário no Supabase Auth (email já confirmado)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createError) {
      const msg = createError.message.toLowerCase().includes('already registered')
        ? 'Este e-mail já possui uma conta. Use "Adicionar" se a conta já existir.'
        : createError.message;
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders });
    }

    // Adiciona à tabela admin_team
    await adminClient.rpc('upsert_admin_team_member', {
      p_email: email.toLowerCase().trim(),
      p_name: name,
      p_role: role,
    });

    return new Response(JSON.stringify({ success: true, userId: newUser.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
