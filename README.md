# Gundam TCG Database

PWA non ufficiale per gestire la collezione di carte **Gundam Trading Card Game**. Frontend vanilla JS, backend [Supabase](https://supabase.com), immagini su Cloudflare R2, deploy su Netlify.

## Requisiti

- Node.js 18+
- Account Supabase (progetto configurato)
- Per upload immagini: credenziali R2 in `scripts/upload/.env`

## Setup locale

```bash
npm install
npm run build:css
```

Servire la root del progetto con un server statico (es. `npx serve .`) e aprire `http://localhost:3000`.

Configurazione runtime in [`js/config.js`](js/config.js) (URL Supabase, anon key, base immagini R2).

## Database Supabase

Applicare le migration in ordine da [`supabase/migrations/`](supabase/migrations/). In produzione devono essere attive almeno:

- **008** — RLS su `cards` e `reference_cards`
- **009** — rimozione tabella `profiles`
- **010** — indici compositi e unique `(user_id, card_code)`

```bash
supabase db push
```

Variabile Edge Function: `CARDTRADER_API_KEY` per il proxy prezzi.

## Catalogo carte (reference)

Il catalogo master è in `reference_cards.json`. Per generare i file partizionati e il manifest:

```bash
npm run build:ref
```

Output: `reference/index.json` + `reference/{SET}.json`. L'app carica il manifest all'avvio e i set on-demand.

## Script utili

| Comando | Descrizione |
|---------|-------------|
| `npm run build:css` | Compila Tailwind in `dist/tailwind.css` |
| `npm run build:ref` | Partiziona il catalogo in `reference/` |
| `node scripts/scrapers/import_expansions.js` | Importa GD05 + Premium PC01A/PC02A in `reference_cards.json` |
| `npm test` | Test unitari (logica pura) |
| `node scripts/scrapers/fetch_cardtrader_ids.mjs --set GD01` | Aggiorna ID CardTrader per un set |
| `node scripts/upload/upload_to_r2.js --set GD05,PC01A,PC02A` | Carica immagini mancanti su Cloudflare R2 |

## Deploy (Netlify)

- Build command: `npm run build:css` (vedi [`netlify.toml`](netlify.toml))
- Publish directory: `.`
- Assicurarsi che le migration Supabase siano applicate in produzione

## Architettura frontend

Moduli JS globali caricati con `defer` da `index.html`. Moduli principali:

- `reference.js` — manifest + lazy-load set
- `cards.js` — CRUD collezione via PostgREST
- `collection-*.js` — overview, filtri, griglia paginata, statistiche
- `service-worker.js` — cache solo asset statici e immagini R2 (mai API Supabase)

## Licenza

MIT — vedi [LICENSE](LICENSE).
