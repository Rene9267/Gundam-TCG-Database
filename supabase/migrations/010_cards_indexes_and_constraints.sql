-- Migration 010: composite index, unique constraint, user_id NOT NULL

-- Remove duplicate rows before unique index (keep newest by updated_at)
DELETE FROM public.cards a
USING public.cards b
WHERE a.user_id = b.user_id
  AND a.card_code = b.card_code
  AND a.id < b.id;

DELETE FROM public.cards
WHERE user_id IS NULL;

ALTER TABLE public.cards
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cards_user_updated
  ON public.cards(user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_user_card_code
  ON public.cards(user_id, card_code);
