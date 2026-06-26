-- ============================================================
-- GUNDAM TCG DATABASE - Setup Completo Supabase
-- Eseguire tutto in una volta nel Supabase SQL Editor
-- ============================================================

-- 1. Creazione tabella cards
CREATE TABLE public.cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    card_name TEXT NOT NULL,
    card_code TEXT NOT NULL,
    set_name TEXT,
    rarity TEXT,
    quantity INTEGER DEFAULT 1,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Indici
CREATE INDEX idx_cards_user_id ON public.cards(user_id);
CREATE INDEX idx_cards_card_code ON public.cards(card_code);

-- 3. Row Level Security
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select" ON public.cards
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated insert" ON public.cards
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated update" ON public.cards
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated delete" ON public.cards
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
