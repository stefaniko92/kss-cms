import { DScoreError } from './dscore/client'
import { getAllLeagues } from './service'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const options = () => new Response(null, { status: 204, headers: CORS })

export const json = (data: unknown, opts: { maxAge?: number; stale?: boolean; status?: number } = {}) =>
  Response.json(data, {
    status: opts.status ?? 200,
    headers: {
      ...CORS,
      // CDN/browser keš; stale-while-revalidate ublažava skokove opterećenja
      'Cache-Control': opts.maxAge ? `public, s-maxage=${opts.maxAge}, stale-while-revalidate=${opts.maxAge * 5}` : 'no-store',
      ...(opts.stale ? { 'X-Data-Stale': '1' } : {}),
    },
  })

export const errorResponse = (status: number, message: string) => json({ error: message }, { status })

export const parseId = (raw: string): number | null => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Izlažemo samo lige koje su javno vidljive u DScore-u (ne i interne, npr. "Srbija OSTALO"). */
export async function isPublicLeague(id: number): Promise<boolean> {
  const leagues = await getAllLeagues()
  return leagues.some((l) => l.id === id && l.visible)
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof DScoreError && e.status === 404) return errorResponse(404, 'Nije pronađeno')
    if (e instanceof DScoreError && e.status === 503) return json({ error: 'Sportski podaci su privremeno nedostupni, pokušajte ponovo za nekoliko minuta' }, { status: 503 })
    console.error('[sports]', e instanceof Error ? e.message : e) // detalji samo u logu, nikad klijentu
    return errorResponse(502, 'Sportski podaci trenutno nisu dostupni')
  }
}
