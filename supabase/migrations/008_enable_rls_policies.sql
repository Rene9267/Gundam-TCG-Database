-- Migration 008: Abilita Row Level Security con policy per-user
-- Risolve la vulnerabilità critica: RLS disabilitato + GRANT ALL ad anon
-- permetteva a chiunque di leggere/modificare i dati di tutti gli utenti.
--
-- Dopo questa migration:
--   • cards: ogni utente vede/modifica solo le proprie carte (user_id = auth.uid())
--   • profiles: ogni utente vede solo il proprio profilo (match per email)
--   • reference_cards: sola lettura pubblica (dati di riferimento)

-- ============================================================
-- 1. TABELLA cards
-- ============================================================

-- Aggiunge DEFAULT auth.uid() alla colonna user_id
-- L'app non invia user_id dal client (vedi js/cards.js:28);
-- Supabase lo imposta automaticamente dal JWT della sessione.
ALTER TABLE public.cards ALTER COLUMN user_id SET DEFAULT auth.uid();

-- GESTIONE RIGHE LEGACY (single-user mode):
-- Se esistono carte con user_id NULL (create prima dell'autenticazione),
-- diventano invisibili dopo l'abilitazione di RLS.
-- Opzione A: riassegnarle al proprietario (sostituire <OWNER_UUID>)
-- UPDATE public.cards SET user_id = '<OWNER_UUID>' WHERE user_id IS NULL;
-- Opzione B: cancellarle se non più necessarie
-- DELETE FROM public.cards WHERE user_id IS NULL;
-- NOTA: Decommentare una delle due opzioni prima di eseguire la migration
-- se ci sono righe legacy. Verificare con: SELECT count(*) FROM public.cards WHERE user_id IS NULL;

-- Aggiunge NOT NULL: ogni carta deve appartenere a un utente autenticato.
-- Decommentare DOPO aver risolto le righe legacy NULL sopra.
-- ALTER TABLE public.cards ALTER COLUMN user_id SET NOT NULL;

-- Abilita RLS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Rimuovi eventuali policy precedenti (idempotente)
DROP POLICY IF EXISTS "Users select own cards" ON public.cards;
DROP POLICY IF EXISTS "Users insert own cards" ON public.cards;
DROP POLICY IF EXISTS "Users update own cards" ON public.cards;
DROP POLICY IF EXISTS "Users delete own cards" ON public.cards;

-- Policy SELECT: un utente può leggere solo le proprie carte
CREATE POLICY "Users select own cards" ON public.cards
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Policy INSERT: un utente può inserire solo carte con il proprio user_id
-- Il DEFAULT auth.uid() garantisce che user_id sia impostato correttamente
-- anche se il client non lo invia.
CREATE POLICY "Users insert own cards" ON public.cards
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy UPDATE: un utente può modificare solo le proprie carte
-- e non può riassegnarle a un altro user_id
CREATE POLICY "Users update own cards" ON public.cards
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy DELETE: un utente può eliminare solo le proprie carte
CREATE POLICY "Users delete own cards" ON public.cards
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================
-- 2. TABELLA profiles
-- ============================================================
-- La tabella profiles ha id = gen_random_uuid() (NON auth.uid()),
-- ma email è UNIQUE e corrisponde a auth.users.email.
-- Usiamo una subquery per matchare l'utente corrente via email.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

-- Policy SELECT: un utente vede solo il proprio profilo (match per email)
CREATE POLICY "Users select own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Policy INSERT: un utente può creare solo il proprio profilo
CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Policy UPDATE: un utente può modificare solo il proprio profilo
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ============================================================
-- 3. TABELLA reference_cards (dati di riferimento pubblici)
-- ============================================================

ALTER TABLE public.reference_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read reference_cards" ON public.reference_cards;

-- Policy SELECT: tutti (anon e authenticated) possono leggere i reference
-- Nessuna policy di scrittura: solo service_role / admin può modificare
CREATE POLICY "Public read reference_cards" ON public.reference_cards
    FOR SELECT TO anon, authenticated
    USING (true);

-- ============================================================
-- 4. REVOKE GRANT ALL e GRANT minimi
-- ============================================================
-- Revoca i permessi eccessivi concessi in migration 005 e 006.
-- Con RLS abilitato, concediamo solo i permessi necessari;
-- le policy filtrano le righe per-user.

-- cards: revoca ALL, concede CRUD a authenticated (filtrato da RLS)
REVOKE ALL ON public.cards FROM anon;
REVOKE ALL ON public.cards FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;

-- profiles: revoca ALL, concede CRUD a authenticated (filtrato da RLS)
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- reference_cards: revoca eventuali grant impliciti,
-- concede solo SELECT ad anon e authenticated (sola lettura pubblica)
REVOKE ALL ON public.reference_cards FROM anon;
REVOKE ALL ON public.reference_cards FROM authenticated;
GRANT SELECT ON public.reference_cards TO anon;
GRANT SELECT ON public.reference_cards TO authenticated;
