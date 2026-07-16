-- Migration 009: Rimuove la tabella public.profiles (DEAD CODE + attack surface)
--
-- Motivazione: la tabella profiles è stata introdotta in migration 006 per
-- validare nickname/email duplicati, ma NESSUN client (js/*) la referenzia
-- (grep verificato: 0 occorrenze). La policy INSERT (migration 008) esponeva
-- il vincolo UNIQUE a enumeration di nickname/email tramite unique_violation
-- distinguibile. Rimuoviamo la superficie d'attacco: nickname resta gestito
-- esclusivamente via auth.users.user_metadata (vedi js/auth.js:saveNickname).

-- Drop policies (create in migration 008) prima di droppare la tabella.
DROP POLICY IF EXISTS "Users select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

-- Drop tabella e indici associati (CASCADE: indici vanno via automaticamente).
DROP TABLE IF EXISTS public.profiles;