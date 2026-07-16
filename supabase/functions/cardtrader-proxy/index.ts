import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CT_API_BASE = 'https://api.cardtrader.com/api/v2'

// Per-instance, in-memory rate limiting (sliding window).
// Mitiga abuso del proxy CardTrader: l'anon key è pubblica, ma verify_jwt
// garantisce che solo utenti autenticati possano invocare la funzione.
// Una distribuzione su più istanze ha limiti indipendenti (good enough
// per proteggere la quota CardTrader da un singolo utente malintenzionato).
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const hits = new Map<string, number[]>()

function rateLimitCheck(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (arr.length >= RATE_LIMIT_MAX) {
    const oldest = arr[0]
    return { ok: false, retryAfter: Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000)) }
  }
  arr.push(now)
  hits.set(key, arr)
  return { ok: true }
}

// Estrae subject (user id) dal JWT. verify_jwt=true garantisce che la firma
// sia già stata validata dal gateway Supabase prima di invocare la funzione:
// possiamo fidare dei claims senza rivalidare la firma qui.
function parseUserSub(req: Request): string | null {
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    return (payload && payload.sub) ? String(payload.sub) : null
  } catch {
    return null
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  // verify_jwt=true: il gateway rifiuta richieste senza JWT valido.
  // Usiamo il sub del JWT solo come chiave per il rate limiting.
  const userSub = parseUserSub(req)
  if (!userSub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }

  const rl = rateLimitCheck(userSub)
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
        ...corsHeaders(),
      },
    })
  }

  try {
    const url = new URL(req.url)
    const blueprintId = url.searchParams.get('blueprint_id')
    if (!blueprintId || !/^\d+$/.test(blueprintId)) {
      return new Response(JSON.stringify({ error: 'blueprint_id required (numeric)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      })
    }

    const apiKey = Deno.env.get('CARDTRADER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      })
    }

    const res = await fetch(`${CT_API_BASE}/marketplace/products?blueprint_id=${blueprintId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    const body = await res.text()

    return new Response(body, {
      status: res.ok ? 200 : res.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
        ...corsHeaders(),
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    })
  }
})