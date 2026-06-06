-- Run this in Supabase SQL Editor

-- 1. Add customer_user_id to orders
alter table orders add column if not exists customer_user_id uuid references auth.users(id);

-- 2. Customers can read their own orders (any restaurant)
create policy "Customers can read own orders"
  on orders for select
  to authenticated
  using (customer_user_id = auth.uid());

-- 3. Customers can cancel their own PENDING orders only
create policy "Customers can cancel pending orders"
  on orders for update
  to authenticated
  using (customer_user_id = auth.uid() and status = 'PENDING')
  with check (status = 'CANCELLED');

-- 4. Enable real-time for UPDATE events on orders (INSERT already enabled)
-- Go to: Supabase Dashboard → Database → Replication → enable UPDATE for orders table
