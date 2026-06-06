-- MenuZap features v4
-- Execute no SQL Editor do Supabase

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS manual_closed BOOLEAN DEFAULT FALSE;
