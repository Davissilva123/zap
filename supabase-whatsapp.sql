-- ============================================================
-- ZapMenu — WhatsApp Chat via Evolution API
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- Config da Evolution API por restaurante
CREATE TABLE IF NOT EXISTS whatsapp_evolution_config (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  api_url       text DEFAULT '',
  api_key       text DEFAULT '',
  instance_name text DEFAULT '',
  bot_enabled   boolean DEFAULT true,
  bot_welcome   text DEFAULT 'Olá! 👋 Bem-vindo! Como posso ajudar?

1️⃣ Ver cardápio
2️⃣ Status do meu pedido
3️⃣ Horário de funcionamento
4️⃣ Falar com atendente',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Conversas (uma por cliente por restaurante)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_phone   text NOT NULL,
  customer_name    text DEFAULT '',
  status           text DEFAULT 'bot' CHECK (status IN ('bot','pending','active','closed')),
  assigned_to_name text DEFAULT '',
  last_message     text DEFAULT '',
  last_message_at  timestamptz DEFAULT now(),
  unread_count     integer DEFAULT 0,
  bot_state        text DEFAULT 'init',
  created_at       timestamptz DEFAULT now(),
  UNIQUE(user_id, customer_phone)
);

-- Mensagens
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('in','out')),
  body            text NOT NULL,
  from_name       text DEFAULT '',
  wa_message_id   text DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_wa_conv_user    ON whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_status  ON whatsapp_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv     ON whatsapp_messages(conversation_id, created_at);

-- RLS
ALTER TABLE whatsapp_evolution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages         ENABLE ROW LEVEL SECURITY;

-- Dono do restaurante acessa apenas seus próprios dados
DROP POLICY IF EXISTS "wa_owner_config"    ON whatsapp_evolution_config;
DROP POLICY IF EXISTS "wa_owner_convs"     ON whatsapp_conversations;
DROP POLICY IF EXISTS "wa_owner_msgs"      ON whatsapp_messages;
DROP POLICY IF EXISTS "wa_service_config"  ON whatsapp_evolution_config;
DROP POLICY IF EXISTS "wa_service_convs"   ON whatsapp_conversations;
DROP POLICY IF EXISTS "wa_service_msgs"    ON whatsapp_messages;

CREATE POLICY "wa_owner_config"   ON whatsapp_evolution_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "wa_owner_convs"    ON whatsapp_conversations    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "wa_owner_msgs"     ON whatsapp_messages         FOR ALL USING (
  conversation_id IN (SELECT id FROM whatsapp_conversations WHERE user_id = auth.uid())
);

-- Edge functions (service_role) podem acessar tudo
CREATE POLICY "wa_service_config" ON whatsapp_evolution_config FOR ALL TO service_role USING (true);
CREATE POLICY "wa_service_convs"  ON whatsapp_conversations    FOR ALL TO service_role USING (true);
CREATE POLICY "wa_service_msgs"   ON whatsapp_messages         FOR ALL TO service_role USING (true);

-- Realtime (para o inbox atualizar automaticamente)
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
