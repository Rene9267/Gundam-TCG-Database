-- Migration 004: Tabella reference_cards (database mastro ufficiale)
-- Contiene TUTTE le carte esistenti per ogni set, usata per:
--   • Mostrare carte mancanti in B/N nella vista collezione
--   • Calcolare automaticamente le percentuali di completamento
--   • Fornire image_url predefiniti per ogni carta

CREATE TABLE public.reference_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    card_code TEXT NOT NULL,
    card_name TEXT NOT NULL,
    set_code TEXT NOT NULL,
    set_name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ogni card_code è unico (es. ST01-001, GD01-001)
CREATE UNIQUE INDEX idx_ref_cards_card_code ON public.reference_cards(card_code);

-- Indice per query per set
CREATE INDEX idx_ref_cards_set_code ON public.reference_cards(set_code);
CREATE INDEX idx_ref_cards_set_name ON public.reference_cards(set_name);

-- RLS disabilitato (stessa policy della tabella cards)
ALTER TABLE public.reference_cards DISABLE ROW LEVEL SECURITY;
