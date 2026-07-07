import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ALLOWED_HOSTS = ['www.gundam-gcg.com']
const CACHE_TTL = 31_536_000

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const target = url.searchParams.get('url')
    if (!target) {
      return new Response(JSON.stringify({ error: 'url parameter required' }), {
        status: 400,
        headers: cors(),
      })
    }

    const parsed = new URL(target)
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'host not allowed' }), {
        status: 403,
        headers: cors(),
      })
    }

    const res = await fetch(target, { headers: { 'User-Agent': 'GundamDB-Proxy/1.0' } })
    const body = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/webp'

    return new Response(body, {
      status: res.ok ? 200 : 502,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_TTL}, immutable`,
        ...cors(),
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: cors(),
    })
  }
})

function cors() {
  return { 'Access-Control-Allow-Origin': '*' }
}
