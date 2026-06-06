-- =========================================
-- ZapMenu — Atualizações do banco de dados
-- Execute no SQL Editor do Supabase
-- =========================================

-- 1. Adicionar imagem nos itens do cardápio
alter table menu_items add column if not exists image_url text not null default '';

-- 2. Adicionar capa do restaurante nas configurações
alter table restaurant_settings add column if not exists cover_url text not null default '';

-- 3. Criar bucket de armazenamento de imagens
insert into storage.buckets (id, name, public)
values ('zapmenu', 'zapmenu', true)
on conflict (id) do nothing;

-- 4. Política: usuários autenticados podem fazer upload
create policy "Auth users can upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'zapmenu');

-- 5. Política: usuários autenticados podem atualizar seus arquivos
create policy "Auth users can update" on storage.objects
for update to authenticated
using (bucket_id = 'zapmenu');

-- 6. Política: usuários autenticados podem deletar seus arquivos
create policy "Auth users can delete" on storage.objects
for delete to authenticated
using (bucket_id = 'zapmenu');

-- 7. Política: leitura pública das imagens
create policy "Public can read images" on storage.objects
for select using (bucket_id = 'zapmenu');

-- 8. Habilitar real-time para a tabela de pedidos
-- (necessário para notificações em tempo real)
-- Vá em: Supabase Dashboard → Database → Replication
-- e habilite "Insert" para a tabela "orders"
