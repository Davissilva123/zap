import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function sendEvolution(apiUrl: string, apiKey: string, instance: string, phone: string, text: string) {
  try {
    await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({ number: phone, textMessage: { text } }),
    });
  } catch { /* ignore send errors */ }
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   '⏳ Aguardando confirmação',
  PAID:      '✅ Pagamento confirmado',
  PREPARING: '👨‍🍳 Sendo preparado na cozinha',
  DELIVERING:'🛵 Saiu para entrega',
  COMPLETED: '✅ Entregue com sucesso',
  CANCELLED: '❌ Cancelado',
};

const DAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('OK');

  const url = new URL(req.url);
  const userId = url.searchParams.get('rid');
  if (!userId) return new Response('Missing rid', { status: 400 });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  // Evolution API envia event = "messages.upsert"
  if (payload.event !== 'messages.upsert') return new Response('OK');

  const data = payload.data as Record<string, unknown> | null;
  if (!data) return new Response('OK');

  const key = data.key as Record<string, unknown> | null;
  if (!key || key.fromMe) return new Response('OK'); // ignora mensagens próprias

  const remoteJid = key.remoteJid as string | undefined;
  if (!remoteJid || remoteJid.includes('@g.us')) return new Response('OK'); // ignora grupos

  const phone = remoteJid.replace('@s.whatsapp.net', '');
  const senderName = (data.pushName as string | undefined) || '';

  const message = data.message as Record<string, unknown> | null;
  const text = (
    (message?.conversation as string | undefined) ||
    ((message?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined) ||
    ''
  ).trim();

  if (!text) return new Response('OK');

  // Busca config do restaurante
  const { data: cfg } = await supabase
    .from('whatsapp_evolution_config')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!cfg) return new Response('Config not found', { status: 404 });

  // Busca configurações do restaurante (horário, slug, nome)
  const { data: settings } = await supabase
    .from('restaurant_settings')
    .select('name, slug, opening_hours')
    .eq('user_id', userId)
    .single();

  const restaurantName = (settings?.name as string | undefined) || 'Restaurante';
  const slug = (settings?.slug as string | undefined) || '';
  const menuUrl = slug ? `${Deno.env.get('SITE_URL') || 'https://zapmenu.vercel.app'}/m/${slug}` : '';

  // Upsert conversa
  const { data: conv, error: convErr } = await supabase
    .from('whatsapp_conversations')
    .upsert({
      user_id: userId,
      customer_phone: phone,
      customer_name: senderName || phone,
      last_message: text.slice(0, 120),
      last_message_at: new Date().toISOString(),
    }, { onConflict: 'user_id,customer_phone' })
    .select()
    .single();

  if (convErr || !conv) return new Response('DB error', { status: 500 });

  // Incrementa não lidas se não está em atendimento humano ativo
  if (conv.status !== 'active') {
    await supabase
      .from('whatsapp_conversations')
      .update({
        unread_count: (conv.unread_count || 0) + 1,
        customer_name: senderName || conv.customer_name || phone,
      })
      .eq('id', conv.id);
  }

  // Salva mensagem recebida
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    direction: 'in',
    body: text,
    from_name: senderName,
    wa_message_id: (key.id as string | undefined) || '',
  });

  // Se humano está atendendo, não interfere
  if (conv.status === 'active') return new Response('OK');

  // Se bot desativado, apenas marca como pendente
  if (!cfg.bot_enabled) {
    await supabase.from('whatsapp_conversations').update({ status: 'pending' }).eq('id', conv.id);
    return new Response('OK');
  }

  // ── LÓGICA DO CHATBOT ──────────────────────────────────
  const botState: string = conv.bot_state || 'init';
  let reply = '';
  let newBotState = botState;
  let newStatus: string = conv.status;

  if (botState === 'waiting_phone') {
    // Usuário enviou telefone para consulta de pedido
    const queryPhone = text.replace(/\D/g, '');
    const { data: orders } = await supabase
      .from('orders')
      .select('status, total, created_at')
      .eq('user_id', userId)
      .ilike('customer_phone', `%${queryPhone}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (orders && orders.length > 0) {
      const order = orders[0] as { status: string; total: number; created_at: string };
      const statusLabel = STATUS_LABELS[order.status] || order.status;
      const date = new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      reply = `📦 *Seu pedido mais recente:*\n\n${statusLabel}\n💰 Total: R$ ${Number(order.total).toFixed(2).replace('.', ',')}\n📅 ${date}\n\nDeseja mais alguma coisa?\n\n1️⃣ Ver cardápio\n4️⃣ Falar com atendente`;
    } else {
      reply = `Não encontrei pedidos com esse número.\n\nTente novamente com o número cadastrado, ou:\n\n1️⃣ Ver cardápio\n4️⃣ Falar com atendente`;
    }
    newBotState = 'menu';

  } else if (text === '1' || /card[aá]pio|menu|quero pedir|fazer pedido/i.test(text)) {
    reply = menuUrl
      ? `🍽️ Acesse nosso cardápio e faça seu pedido:\n\n${menuUrl}\n\nSe precisar de mais alguma coisa, é só chamar! 😊`
      : `Para ver nosso cardápio, entre em contato diretamente com a gente. 😊`;
    newBotState = 'menu';

  } else if (text === '2' || /status|pedido|rastrear|onde.*meu/i.test(text)) {
    reply = `Para verificar seu pedido, por favor me informe o número de telefone cadastrado:`;
    newBotState = 'waiting_phone';

  } else if (text === '3' || /hor[aá]rio|que.*hora|aberto|fecha|funciona/i.test(text)) {
    const hours = settings?.opening_hours as Record<string, { open: boolean; from: string; to: string }> | null;
    let hoursText = '';
    if (hours && Object.keys(hours).length > 0) {
      hoursText = Object.entries(hours)
        .map(([d, h]) => h.open ? `${DAYS[Number(d)]}: ${h.from} às ${h.to}` : `${DAYS[Number(d)]}: Fechado`)
        .join('\n');
    }
    reply = hoursText
      ? `⏰ *Horários de funcionamento:*\n\n${hoursText}\n\nPosso ajudar com mais alguma coisa? 😊`
      : `Para saber nossos horários, entre em contato conosco. 😊`;
    newBotState = 'menu';

  } else if (text === '4' || /atendente|humano|pessoa|falar.*algu[eé]m|ajuda/i.test(text)) {
    reply = `Ok! Vou chamar um atendente para você. Em breve alguém irá te atender. 😊\n\nAguarde um momento...`;
    newBotState = 'handoff';
    newStatus = 'pending';

  } else if (botState === 'menu') {
    // Já passou pelo menu, não reconheceu o comando
    reply = `Desculpe, não entendi. 😅\n\nEscolha uma das opções:\n\n1️⃣ Ver cardápio\n2️⃣ Status do meu pedido\n3️⃣ Horário de funcionamento\n4️⃣ Falar com atendente`;

  } else {
    // Primeira interação — mostra boas-vindas + menu
    const welcome = (cfg.bot_welcome as string | undefined) ||
      `Olá! 👋 Bem-vindo ao *${restaurantName}*!\n\nComo posso ajudar?\n\n1️⃣ Ver cardápio\n2️⃣ Status do meu pedido\n3️⃣ Horário de funcionamento\n4️⃣ Falar com atendente`;
    reply = welcome.replace('{restaurantName}', restaurantName);
    newBotState = 'menu';
  }

  // Atualiza estado da conversa
  await supabase.from('whatsapp_conversations').update({
    bot_state: newBotState,
    status: newStatus,
  }).eq('id', conv.id);

  // Envia resposta e salva no histórico
  if (reply) {
    await sendEvolution(cfg.api_url, cfg.api_key, cfg.instance_name, phone, reply);
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conv.id,
      direction: 'out',
      body: reply,
      from_name: restaurantName,
    });
  }

  return new Response('OK');
});
