-- Tabela de configurações da página de marketing
CREATE TABLE IF NOT EXISTS marketing_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  whatsapp_number TEXT NOT NULL DEFAULT '5511999999999',
  whatsapp_message TEXT NOT NULL DEFAULT 'Olá! Tenho interesse em saber mais sobre o ZapMenu para meu restaurante. Pode me ajudar?',
  contact_email TEXT NOT NULL DEFAULT 'contato@zapmenu.com.br',
  contact_phone TEXT NOT NULL DEFAULT '+55 (11) 99999-9999',
  hero_title TEXT NOT NULL DEFAULT 'Cardápio digital para o seu restaurante',
  hero_subtitle TEXT NOT NULL DEFAULT 'Crie seu cardápio, gere QR Codes e receba pedidos com pagamento via PIX — tudo em um só lugar.',
  company_name TEXT NOT NULL DEFAULT 'ZapMenu',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insere a linha padrão se não existir
INSERT INTO marketing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: leitura pública (anon pode ler), escrita só autenticados (superadmin via service_role ou authenticated)
ALTER TABLE marketing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_settings_read" ON marketing_settings;
CREATE POLICY "marketing_settings_read"
  ON marketing_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "marketing_settings_write" ON marketing_settings;
CREATE POLICY "marketing_settings_write"
  ON marketing_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
