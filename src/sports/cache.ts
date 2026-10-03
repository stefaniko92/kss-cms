import config from '@payload-config'
import { getPayload } from 'payload'

type Kind = 'leagues' | 'league' | 'standings' | 'schedule' | 'match' | 'leaders'

export type CacheOptions<T> = {
  key: string
  kind: Kind
  leagueId?: number
  /** sekunde; može i funkcija koja gleda svež rezultat (npr. završene utakmice se keširaju dugo) */
  ttl: number | ((data: T) => number)
  finished?: (data: T) => boolean
  fetcher: () => Promise<T>
}

const inflight = new Map<string, Promise<unknown>>()

/**
 * get-or-fetch sa TTL-om. Ako izvor padne, vraća zastareli keš (stale-if-error) umesto greške.
 * Istovremeni zahtevi za isti ključ dele jedan poziv ka izvoru.
 */
export async function cached<T>(opts: CacheOptions<T>): Promise<{ data: T; stale: boolean; fetchedAt: string }> {
  const payload = await getPayload({ config })
  const existing = (
    await payload.find({ collection: 'sports-cache', where: { key: { equals: opts.key } }, limit: 1, depth: 0, overrideAccess: true })
  ).docs[0]

  if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
    return { data: existing.data as T, stale: false, fetchedAt: existing.fetchedAt }
  }

  let pending = inflight.get(opts.key) as Promise<T> | undefined
  if (!pending) {
    pending = (async () => {
      const data = await opts.fetcher()
      const ttl = typeof opts.ttl === 'function' ? opts.ttl(data) : opts.ttl
      const now = new Date()
      const doc = {
        key: opts.key,
        kind: opts.kind,
        leagueId: opts.leagueId,
        finished: opts.finished ? opts.finished(data) : false,
        data: data as never,
        fetchedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
      }
      if (existing) await payload.update({ collection: 'sports-cache', id: existing.id, data: doc, overrideAccess: true })
      else await payload.create({ collection: 'sports-cache', data: doc, overrideAccess: true })
      return data
    })().finally(() => inflight.delete(opts.key))
    inflight.set(opts.key, pending)
  }

  try {
    const data = await pending
    return { data, stale: false, fetchedAt: new Date().toISOString() }
  } catch (e) {
    if (existing) return { data: existing.data as T, stale: true, fetchedAt: existing.fetchedAt }
    throw e
  }
}
