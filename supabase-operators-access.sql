-- =============================================
-- ZapMenu – Sistema de Operadores com Acesso
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. Adiciona coluna user_id em operators (liga ao usuário Supabase do operador)
alter table operators add column if not exists user_id uuid references auth.users(id);

-- 2. RLS – Operador pode ler seu próprio registro pelo e-mail ou user_id
drop policy if exists "owner_manage_operators" on operators;
create policy "owner_manage_operators" on operators for all
using (auth.uid() = owner_id);

drop policy if exists "operator_self_read" on operators;
create policy "operator_self_read" on operators for select
using (auth.email() = email OR auth.uid() = user_id);

drop policy if exists "operator_set_userid" on operators;
create policy "operator_set_userid" on operators for update
using (auth.email() = email)
with check (user_id = auth.uid() AND owner_id = owner_id);

-- 3. Operadores podem LER pedidos do restaurante deles
drop policy if exists "operators_read_orders" on orders;
create policy "operators_read_orders" on orders for select
using (
  auth.uid() = user_id OR
  exists (
    select 1 from operators op
    where op.user_id = auth.uid()
      and op.owner_id = orders.user_id
      and op.active = true
  )
);

-- 4. Operadores podem ATUALIZAR status dos pedidos
drop policy if exists "operators_update_orders" on orders;
create policy "operators_update_orders" on orders for update
using (
  auth.uid() = user_id OR
  exists (
    select 1 from operators op
    where op.user_id = auth.uid()
      and op.owner_id = orders.user_id
      and op.active = true
  )
);

-- 5. Operadores podem LER itens do cardápio
drop policy if exists "operators_read_menu_items" on menu_items;
create policy "operators_read_menu_items" on menu_items for select
using (
  auth.uid() = user_id OR
  exists (
    select 1 from operators op
    where op.user_id = auth.uid()
      and op.owner_id = menu_items.user_id
      and op.active = true
  )
);

-- 6. Operadores podem ATUALIZAR itens (para marcar esgotado – apenas admin)
drop policy if exists "operators_update_menu_items" on menu_items;
create policy "operators_update_menu_items" on menu_items for update
using (
  auth.uid() = user_id OR
  exists (
    select 1 from operators op
    where op.user_id = auth.uid()
      and op.owner_id = menu_items.user_id
      and op.active = true
      and op.role = 'admin'
  )
);

-- 7. Operadores podem LER categorias
drop policy if exists "operators_read_categories" on categories;
create policy "operators_read_categories" on categories for select
using (
  auth.uid() = user_id OR
  exists (
    select 1 from operators op
    where op.user_id = auth.uid()
      and op.owner_id = categories.user_id
      and op.active = true
  )
);

-- 8. Operadores podem LER configurações (nome do restaurante, etc)
drop policy if exists "operators_read_settings" on restaurant_settings;
create policy "operators_read_settings" on restaurant_settings for select
using (
  auth.uid() = user_id OR
  exists (
    select 1 from operators op
    where op.user_id = auth.uid()
      and op.owner_id = restaurant_settings.user_id
      and op.active = true
  )
);
