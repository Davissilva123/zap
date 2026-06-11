import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  // Autentica usuário via JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let body: { conversationId: string; message: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  const { conversationId, message } = body;
  if (!conversationId || !message?.trim()) {
    return new Response(JSON.stringify({ error: 'conversationId e message são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Busca a conversa (valida que pertence ao usuário)
  const { data: conv, error: convErr } = await serviceClient
    .from('whatsapp_conversations')
    .select('id, customer_phone, user_id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (convErr || !conv) {
    return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Busca config da Evolution API
  const { data: cfg, error: cfgErr } = await serviceClient
    .from('whatsapp_evolution_config')
    .select('api_url, api_key, instance_name')
    .eq('user_id', user.id)
    .single();

  if (cfgErr || !cfg || !cfg.api_url || !cfg.api_key || !cfg.instance_name) {
    return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Envia para Evolution API
  const evoRes = await fetch(`${cfg.api_url}/message/sendText/${cfg.instance_name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': cfg.api_key },
    body: JSON.stringify({ number: conv.customer_phone, textMessage: { text: message.trim() } }),
  });

  if (!evoRes.ok) {
    const errText = await evoRes.text();
    return new Response(JSON.stringify({ error: `Evolution API error: ${errText}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Busca nome do restaurante para o remetente
  const { data: settings } = await serviceClient.from('restaurant_settings').select('name').eq('user_id', user.id).single();
  const fromName = (settings?.name as string | undefined) || 'Restaurante';

  // Salva mensagem enviada
  const { data: msg } = await serviceClient.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'out',
    body: message.trim(),
    from_name: fromName,
  }).select().single();

  // Atualiza última mensagem da conversa e garante status 'active'
  await serviceClient.from('whatsapp_conversations').update({
    last_message: message.trim().slice(0, 120),
    last_message_at: new Date().toISOString(),
    status: 'active',
    bot_state: 'handoff',
  }).eq('id', conversationId);

  return new Response(JSON.stringify({ ok: true, message: msg }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
