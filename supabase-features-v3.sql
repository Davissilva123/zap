-- supabase-features-v3.sql
-- Execute no SQL Editor do Supabase (Dashboard → SQL Editor → New Query)

-- 1. Agendamento de pedidos
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- 2. Programa de fidelidade (configurações do restaurante)
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS loyalty_orders_needed INTEGER DEFAULT 10;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS loyalty_reward TEXT DEFAULT '';
