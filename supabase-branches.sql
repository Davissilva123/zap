-- Multi-location: restaurant branches
-- Run this in Supabase SQL Editor

-- 1. Branches table
CREATE TABLE IF NOT EXISTS public.restaurant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.restaurant_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.restaurant_branches
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 2. Orders: add branch_id column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL;

-- 3. RPC: get_branches
CREATE OR REPLACE FUNCTION public.get_branches(p_owner_id UUID)
RETURNS TABLE(
  id UUID, owner_id UUID, name TEXT, slug TEXT,
  address TEXT, phone TEXT, active BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  RETURN QUERY
    SELECT b.id, b.owner_id, b.name, b.slug, b.address, b.phone, b.active, b.created_at
    FROM public.restaurant_branches b
    WHERE b.owner_id = p_owner_id
    ORDER BY b.created_at ASC;
END;
$func$;

-- 4. RPC: add_branch
CREATE OR REPLACE FUNCTION public.add_branch(
  p_owner_id UUID, p_name TEXT, p_slug TEXT, p_address TEXT, p_phone TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() != p_owner_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.restaurant_branches (owner_id, name, slug, address, phone)
  VALUES (p_owner_id, p_name, p_slug, p_address, p_phone)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$func$;

-- 5. RPC: update_branch
CREATE OR REPLACE FUNCTION public.update_branch(
  p_id UUID, p_name TEXT, p_slug TEXT, p_address TEXT, p_phone TEXT, p_active BOOLEAN
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  UPDATE public.restaurant_branches
  SET name = p_name, slug = p_slug, address = p_address, phone = p_phone, active = p_active
  WHERE id = p_id AND owner_id = auth.uid();
END;
$func$;

-- 6. RPC: delete_branch
CREATE OR REPLACE FUNCTION public.delete_branch(p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  DELETE FROM public.restaurant_branches WHERE id = p_id AND owner_id = auth.uid();
END;
$func$;

-- 7. Allow public menu to look up branch slug
CREATE OR REPLACE FUNCTION public.get_menu_by_branch_slug(p_slug TEXT)
RETURNS TABLE(
  owner_id UUID, branch_name TEXT, branch_address TEXT, branch_phone TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  RETURN QUERY
    SELECT b.owner_id, b.name, b.address, b.phone
    FROM public.restaurant_branches b
    WHERE b.slug = p_slug AND b.active = true
    LIMIT 1;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_branches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_branch(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_branch(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_branch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_menu_by_branch_slug(TEXT) TO anon, authenticated;
