-- Migration 002: RLS policies e configurazione storage
-- Eseguire DOPO la migration 001

-- Abilitazione Row Level Security
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Policy: Lettura consentita solo al proprietario
CREATE POLICY "Allow authenticated select" ON public.cards
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Policy: Inserimento consentito solo al proprietario
CREATE POLICY "Allow authenticated insert" ON public.cards
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Policy: Aggiornamento consentito solo al proprietario
CREATE POLICY "Allow authenticated update" ON public.cards
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Policy: Eliminazione consentita solo al proprietario
CREATE POLICY "Allow authenticated delete" ON public.cards
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Nota: le immagini sono gestite tramite URL esterni (colonna image_url).
-- Non è necessario creare bucket Storage su Supabase.
