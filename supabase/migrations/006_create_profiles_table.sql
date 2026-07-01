-- Migration 006: Tabella profiles per validazione nickname/email duplicati
-- Usata per verificare nickname unici (impossibile via auth.users)
-- e per dare feedback "Email già registrata" o "Nickname già in uso"

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nickname TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.profiles TO anon;
