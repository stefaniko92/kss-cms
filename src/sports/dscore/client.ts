/**
 * Tanki klijent za DScore API (samo čitanje). Ključ je samo na serveru (DSCORE_API_KEY).
 * Odgovori sadrže privatne podatke (e-mailovi, telefoni) — svaki poziv ide kroz normalize.ts.
 *
 * Poštovanje limita: API javlja `X-RateLimit-Limit: 60` (po minutu). Prekoračenje aktivira Cloudflare proveru
 * ("public_data_verification_required", HTTP 403) za ceo ključ. Zato:
 *  - klizni prozor od 60 s: najviše LIVE_MAX zahteva za uživo/korisnike, a bulk (sinhronizacija) samo dok je
 *    ukupno ispod BULK_MAX, pa bulk ustupa mesto korisnicima;
 *  - kad stigne 403 provera, prekidač stoji BLOCK_MS i pozivi odmah padaju (cache.ts tada služi zastareli keš).
 * Proveru NIKAD ne zaobilazimo; rešenje je dogovor sa DScore-om o ključu za server-server.
 */
export class DScoreError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export type Lane = 'live' | 'bulk'

const WINDOW_MS = 60_000
const LIVE_MAX = Number(process.env.DSCORE_RATE_LIVE ?? 40)
const BULK_MAX = Number(process.env.DSCORE_RATE_BULK ?? 15)
const BLOCK_MS = Number(process.env.DSCORE_BLOCK_MINUTES ?? 10) * 60_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// stanje je po procesu; više procesa (server + skripta) dele samo kvotu koju smo ostavili u rezervi
const g = globalThis as unknown as { __dscore?: { hits: number[]; blockedUntil: number } }
const state = (g.__dscore ??= { hits: [], blockedUntil: 0 })

async function acquire(lane: Lane) {
  const max = lane === 'bulk' ? BULK_MAX : LIVE_MAX
  for (;;) {
    const now = Date.now()
    if (state.blockedUntil > now) throw new DScoreError('DScore je privremeno blokiran (provera posetioca); koristi se keš', 503)
    state.hits = state.hits.filter((t) => now - t < WINDOW_MS)
    if (state.hits.length < max) {
      state.hits.push(now)
      return
    }
    await sleep(Math.min(state.hits[0] + WINDOW_MS - now + 50, 5_000))
  }
}

export const isBlocked = () => state.blockedUntil > Date.now()

export async function dscoreGet<T = unknown>(path: string, opts: { retries?: number; timeoutMs?: number; lane?: Lane } = {}): Promise<T> {
  const base = process.env.DSCORE_API_URL
  const key = process.env.DSCORE_API_KEY
  if (!base || !key) throw new DScoreError('DSCORE_API_URL / DSCORE_API_KEY nisu podešeni', 500)

  const { retries = 3, timeoutMs = 60_000, lane = 'live' } = opts
  const url = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    await acquire(lane)
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.ok) return (await res.json()) as T
      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { code?: string }
        if (body.code === 'public_data_verification_required') {
          state.blockedUntil = Date.now() + BLOCK_MS
          console.error(`[dscore] provera posetioca aktivirana; pauza ${BLOCK_MS / 60_000} min`)
          throw new DScoreError('DScore zahteva proveru posetioca (ograničenje broja zahteva)', 503)
        }
      }
      // 4xx osim 429 se ne ponavlja
      if (res.status < 500 && res.status !== 429) throw new DScoreError(`DScore ${res.status} za ${path}`, res.status)
      lastError = new DScoreError(`DScore ${res.status} za ${path}`, res.status)
    } catch (e) {
      if (e instanceof DScoreError && (e.status === 503 || (e.status < 500 && e.status !== 429))) throw e
      lastError = e
    }
    if (attempt < retries) await sleep(1000 * 2 ** (attempt - 1))
  }
  throw lastError instanceof Error ? lastError : new DScoreError(`DScore nedostupan: ${path}`, 502)
}
