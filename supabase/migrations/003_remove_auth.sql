-- Migration 003: Rimuove autenticazione obbligatoria (single-user mode)
-- Rende user_id opzionale, disabilita RLS per accesso pubblico con anon key

ALTER TABLE public.cards ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_user_id_fkey;

ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated select" ON public.cards;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.cards;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.cards;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.cards;
