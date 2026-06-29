-- ============================================================
-- GUNDAM TCG DATABASE - Setup Completo Supabase
-- Modalità single-user (nessun login richiesto)
-- ============================================================

-- 1. Creazione tabella cards (senza FK obbligatorio su auth.users)
CREATE TABLE public.cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
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

-- Nota: RLS disabilitato — l'app usa solo la anon key pubblica.
-- Per un uso personale è sufficiente. In futuro si può riattivare.
