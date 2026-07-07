import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CT_API_BASE = 'https://api.cardtrader.com/api/v2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  // Validate auth header
  const auth = req.headers.get('authorization') || ''
  const expected = `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`
  if (auth !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders(),
    })
  }

  try {
    const url = new URL(req.url)
    const blueprintId = url.searchParams.get('blueprint_id')
    if (!blueprintId) {
      return new Response(JSON.stringify({ error: 'blueprint_id required' }), {
        status: 400,
        headers: corsHeaders(),
      })
    }

    const apiKey = Deno.env.get('CARDTRADER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
        status: 500,
        headers: corsHeaders(),
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
      headers: corsHeaders(),
    })
  }
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
