-- Migration 005: Concede permessi al ruolo anon sulla tabella cards
-- RLS è disabilitato ma il ruolo anon necessita di permessi espliciti
-- per operare via PostgREST API.

GRANT ALL ON public.cards TO anon;
