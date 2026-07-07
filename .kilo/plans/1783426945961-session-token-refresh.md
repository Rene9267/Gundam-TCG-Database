# Sessione utente & refresh dei token — Analisi (no codice)

## Contesto
La SPA usa `fetch` grezzo contro le API REST + Auth di Supabase con l'anon key e un bearer token gestito manualmente. Non esiste il client JS ufficiale di Supabase, quindi **nessuna logica automatica di refresh dei token**. Dopo la scadenza dell'access token (~1h), le chiamate dati (es. `loadCards()`) tornano 401 e l'app forza il logout via `handle401()`.

## Dove vivono i token oggi (js/supabase.js)
- `saveSession(user, token, remember)`: salva SOLO `supabase_token` (= access token) + `supabase_user` in `localStorage` (remember=true) o `sessionStorage` (remember=false).
- `loadSession()`: ripristina solo `accessToken` da `supabase_token`.
- `authSignIn()`: chiama `/auth/v1/token?grant_type=password`, poi `saveSession(data.user, data.access_token, remember)` — **scarta `data.refresh_token` e `data.expires_in`**.
- `getAuthHeaders()`: attacca `Authorization: Bearer <accessToken>`; nessuna nozione di scadenza.
- `authFetch()`: usata SOLO per signup/recover; né bearer né refresh.

## Perché non c'è refresh automatico (js/cards.js, js/supabase.js)
- Le chiamate dati (`loadCards`, `addCard`, `updateCard`, `deleteCard`) usano `fetch` + `getAuthHeaders()` e **non intercettano/ritentano il 401**.
- Al 401, `handle401()` (cards.js) cancella la sessione e rimbalza al login — "panico" invece di rinnovare. Esiste uno scheletro `window._sessionExpiring` (set in `handle401`, reset in `showAuthed`) che suggerisce l'intenzione di gestire la scadenza, ma non gli è mai stata collegata alcuna logica di rinnovo.

## Punti in cui manca la logica (concettuale)
1. `authSignIn` (supabase.js) — scarta `refresh_token`/`expires_in`; va catturato e persistito.
2. `saveSession` / `loadSession` (supabase.js) — persiste solo access token; servono refresh token + expiry.
3. `getAuthHeaders` (supabase.js) — nessuna consapevolezza di scadenza.
4. Chiamate dati `loadCards/addCard/updateCard/deleteCard` (cards.js) — nessun ciclo 401 → refresh → retry.
5. `handle401` (cards.js) — logout su 401 invece di refresh-or-logout.
6. `authFetch` (supabase.js) — recover fallirebbe post-scadenza; non refresh-aware.
7. (Edge) `authSignOut`/`clearSession` — ok, ma un vero refresh dovrebbe invalidare il refresh token ruotato lato server al logout.

## Fix inteso (concettuale, nessun codice)
- Persistere il `refresh_token` (e `expires_at`) accanto all'access token.
- Aggiungere un unico percorso di refresh: a ogni 401 (o poco prima di `expires_at`), chiamare `/auth/v1/token?grant_type=refresh_token` col `refresh_token` salvato, aggiornare access+refresh nello storage e ritentare la richiesta originale una volta sola.
- Solo se il refresh stesso fallisce → fallback a `handle401()` (logout).
- Usare un guard per refresh concorrenti (il flag `window._sessionExpiring` esiste già e può essere riusato).

## Rischi / domande aperte (nessun codice)
- Salvare il refresh token in `localStorage` amplia la superficie di attacco XSS (stesso rischio dell'access token già lì). Accettabile data l'architettura attuale, ma da segnalare.
- Supabase ruota il refresh token a ogni uso → lo storage va aggiornato atomicamente a ogni refresh.

## Validazione (concettuale)
- Attendere > TTL del token senza attività, scatenare una chiamata dati, verificare che faccia refresh silenzioso e vada a buon fine (nessun logout).
- Forzare un 401 con refresh token invalidato → verificare logout graceful.
