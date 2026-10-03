/**
 * Uvoz sadržaja iz WordPress-a (javni REST API) u Payload.
 *
 * npm run import:wp -- site=lige limit=50          # probni uvoz, bez slika
 * npm run import:wp -- site=lige media update       # puni uvoz sa slikama i PDF-ovima
 *
 * Opcije:
 *   site=lige|kss     obavezno
 *   limit=N           najviše N objava (po datumu, najstarije prve)
 *   after=YYYY-MM-DD  samo objave posle datuma
 *   ids=1,2,3         samo te objave (po WP ID)
 *   media             preuzmi naslovne i inline slike i PDF priloge u Media
 *   update            ažuriraj već uvezene (po legacyId); bez toga se preskaču
 *   concurrency=N     paralelnih objava (podrazumevano 4)
 *
 * Idempotentno po (tenant, legacyId). Ne briše ništa.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { slugify } from '../fields/slug'
import { createImportContext, decode, parseArgs, pMap, stripTags, wpFetch } from './lib/wp'

// ---------------------------------------------------------------- argumenti
const args = parseArgs()
const SITE = args.site as 'lige' | 'kss'
const LIMIT = args.limit ? Number(args.limit) : Infinity
const WITH_MEDIA = args.media === 'true'
const UPDATE = args.update === 'true'
const CONCURRENCY = Number(args.concurrency ?? 4)
const AFTER = args.after as string | undefined // YYYY-MM-DD
const IDS = args.ids?.split(',').map(Number).filter(Boolean) // ids=7022,45865

type SiteConfig = {
  origin: string
  tenantSlug: string
  /** WP kategorija (lowercase) → Document; ostalo su Article */
  documentCategories: Record<string, { type: string; commission?: string }>
  /** WP kategorija (lowercase) → Article.placement */
  placements: Record<string, 'featured' | 'hero-slider'>
}

const SITES: Record<string, SiteConfig> = {
  lige: {
    origin: 'https://lige.kss.rs',
    tenantSlug: 'lige',
    documentCategories: {
      'odluke o registraciji': { type: 'registration-decision', commission: 'registration' },
      'odluke uo kss': { type: 'ukss-decision', commission: 'ukss' },
      'odluke za takmičenje': { type: 'competition-decision', commission: 'competition' },
      'odluke disciplinski sud': { type: 'disciplinary-decision', commission: 'disciplinary' },
      'profesionalni ugovor': { type: 'pro-contract', commission: 'registration' },
      'sudijska komisija kss': { type: 'other', commission: 'referees' },
      dzs: { type: 'permit' },
    },
    placements: {},
  },
  kss: {
    origin: 'https://kss.rs',
    tenantSlug: 'kss',
    documentCategories: {},
    placements: { 'vesti - glavne': 'featured', baner: 'hero-slider' },
  },
}

if (!SITE || !SITES[SITE]) {
  console.error('Koristi: npm run import:wp -- site=lige|kss [limit=N] [media] [update]')
  process.exit(1)
}
const SC = SITES[SITE]

// ------------------------------------------------------------------- pomoćno
const MATCH_TITLE = /^(?:[^,]{2,40},\s*)?.{2,60}\s[–-]\s.{2,60}?,?\s*\d{1,3}\s*:\s*\d{1,3}\s*$/

async function wpPaged<T>(path: string, limit = Infinity): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?'
    if (process.env.IMPORT_DEBUG) console.log('GET', path.slice(0, 90), 'page', page)
    const res = await wpFetch(`${SC.origin}/wp-json/wp/v2/${path}${sep}per_page=100&page=${page}`)
    if (process.env.IMPORT_DEBUG) console.log('  ->', res.status)
    if (!res.ok) break
    const items = (await res.json()) as T[]
    out.push(...items)
    // X-WP-TotalPages nije pouzdan (lige javlja 62.955 objava umesto ~5.4k), pa stajemo na nepunoj stranici
    if (items.length < 100 || out.length >= limit) break
  }
  return out.slice(0, limit)
}

// Offset paginacija (page=N) je na velikoj bazi sve sporija (stranica 30 ~ 20 s), pa idemo po datumu:
// uvek prva stranica posle datuma poslednje objave. Duplikate (isti datum) izbacujemo po ID-u.
async function wpPostsByDate<T extends { id: number; date: string }>(extraQs: string, after: string | undefined, limit: number): Promise<T[]> {
  const out: T[] = []
  const seen = new Set<number>()
  let cursor = after ? `${after}T00:00:00` : undefined
  for (;;) {
    const qs = `${extraQs}&orderby=date&order=asc&per_page=100${cursor ? `&after=${cursor}` : ''}`
    const res = await wpFetch(`${SC.origin}/wp-json/wp/v2/posts?${qs}`)
    if (!res.ok) throw new Error(`WP ${res.status} za ${qs}`)
    const items = (await res.json()) as T[]
    const fresh = items.filter((p) => !seen.has(p.id))
    for (const p of fresh) seen.add(p.id)
    out.push(...fresh)
    if (process.env.IMPORT_DEBUG || out.length % 500 < 100) console.log(`  preuzeto ${out.length} objava (do ${items.at(-1)?.date ?? '-'})`)
    if (items.length < 100 || fresh.length === 0 || out.length >= limit) break
    const last = new Date(`${items.at(-1)!.date}Z`)
    cursor = new Date(last.getTime() - 1000).toISOString().slice(0, 19)
  }
  return out.slice(0, limit)
}

// ------------------------------------------------------------------ glavni deo
const payload = await getPayload({ config })
const tenant = (await payload.find({ collection: 'tenants', where: { slug: { equals: SC.tenantSlug } }, limit: 1 })).docs[0]
if (!tenant) throw new Error(`Sajt "${SC.tenantSlug}" ne postoji. Pokreni: npm run seed`)

const ctx = await createImportContext({ payload, tenantId: tenant.id, origin: SC.origin, withMedia: WITH_MEDIA, label: SITE })
const { logFile, logErr, stats, importMedia, htmlToBody } = ctx
stats.documents = 0
stats.articles = 0

const byLegacy = async (collection: 'articles' | 'documents' | 'categories' | 'tags', legacyId: number) =>
  (
    await payload.find({
      collection,
      where: { and: [{ tenant: { equals: tenant.id } }, { legacyId: { equals: legacyId } }] },
      limit: 1,
      depth: 0,
      draft: true,
    })
  ).docs[0]

// ---- kategorije i oznake
type WpTerm = { id: number; name: string; slug: string; parent?: number; link: string }
const catMap = new Map<number, number>() // wpId -> payload id
const catNames = new Map<number, string>() // wpId -> lowercase name
const tagMap = new Map<number, number>()

async function importTerms() {
  const cats = await wpPaged<WpTerm>('categories')
  for (const c of cats) catNames.set(c.id, decode(c.name).toLowerCase())
  for (const pass of [0, 1]) {
    for (const c of cats) {
      const existing = await byLegacy('categories', c.id)
      const parent = c.parent ? catMap.get(c.parent) : undefined
      if (existing) {
        catMap.set(c.id, existing.id)
        if (pass === 1 && parent && !(existing as { parent?: unknown }).parent) await payload.update({ collection: 'categories', id: existing.id, data: { parent } })
        continue
      }
      if (pass === 1) continue
      const doc = await payload.create({
        collection: 'categories',
        data: { name: decode(c.name), slug: c.slug, tenant: tenant.id, legacyId: c.id, legacyUrl: c.link },
      })
      catMap.set(c.id, doc.id)
    }
  }
  const tags = await wpPaged<WpTerm>('tags')
  for (const t of tags) {
    const existing = await byLegacy('tags', t.id)
    if (existing) {
      tagMap.set(t.id, existing.id)
      continue
    }
    const doc = await payload.create({
      collection: 'tags',
      data: { name: decode(t.name), slug: t.slug, tenant: tenant.id, legacyId: t.id, legacyUrl: t.link },
    })
    tagMap.set(t.id, doc.id)
  }
  console.log(`Kategorije: ${cats.length}, oznake: ${tags.length}`)
}

// ---- objave
type WpPost = {
  id: number
  date: string
  date_gmt: string
  slug: string
  link: string
  title: { rendered: string }
  content: { rendered: string }
  excerpt: { rendered: string }
  categories: number[]
  tags: number[]
  _embedded?: { 'wp:featuredmedia'?: { source_url?: string; alt_text?: string }[] }
}

async function importPost(post: WpPost) {
  const title = stripTags(post.title.rendered) || `(bez naslova ${post.id})`
  const catNamesOfPost = post.categories.map((id) => catNames.get(id) ?? '')
  const docCat = catNamesOfPost.map((n) => SC.documentCategories[n]).find(Boolean)
  const asDocument = Boolean(docCat)
  const collection = asDocument ? 'documents' : 'articles'

  const existing = await byLegacy(collection, post.id)
  if (existing && !UPDATE) {
    stats.skipped++
    return
  }

  const { body, pdfs } = await htmlToBody(post.content.rendered)
  const publishedAt = post.date_gmt ? `${post.date_gmt}Z` : undefined
  const categories = post.categories.map((id) => catMap.get(id)).filter((x): x is number => Boolean(x))
  const tags = post.tags.map((id) => tagMap.get(id)).filter((x): x is number => Boolean(x))

  const common = {
    title,
    tenant: tenant.id,
    legacyId: post.id,
    legacyUrl: post.link,
    legacyHtml: post.content.rendered,
    body: body as never,
    _status: 'published' as const,
  }

  let data: Record<string, unknown>
  if (asDocument) {
    const files: number[] = []
    for (const url of [...new Set(pdfs)].slice(0, 10)) {
      const id = await importMedia(url, title)
      if (id) files.push(id)
    }
    data = {
      ...common,
      type: docCat!.type,
      commission: docCat!.commission,
      date: publishedAt,
      file: files[0],
      attachments: files.slice(1).map((file) => ({ file })),
    }
  } else {
    const featured = post._embedded?.['wp:featuredmedia']?.[0]
    const heroImage = featured?.source_url ? await importMedia(featured.source_url, featured.alt_text) : null
    const placement = catNamesOfPost.map((n) => SC.placements[n]).find(Boolean) ?? 'none'
    const excerpt = stripTags(post.excerpt.rendered).slice(0, 300) || undefined
    data = {
      ...common,
      slug: slugify(post.slug) || slugify(title),
      kind: MATCH_TITLE.test(title) ? 'match-report' : 'news',
      placement,
      publishedAt,
      excerpt,
      heroImage: heroImage ?? undefined,
      categories,
      tags,
    }
  }

  if (existing) {
    await payload.update({ collection, id: existing.id, data: data as never, draft: false })
    stats.updated++
  } else {
    await payload.create({ collection, data: data as never })
    stats.created++
  }
  asDocument ? stats.documents++ : stats.articles++
}

async function main() {
  console.log(`Uvoz: ${SITE} (${SC.origin}) limit=${LIMIT} media=${WITH_MEDIA} update=${UPDATE} concurrency=${CONCURRENCY}`)
  await importTerms()
  const posts = IDS?.length
    ? ((await (await wpFetch(`${SC.origin}/wp-json/wp/v2/posts?_embed=wp:featuredmedia&include=${IDS.join(',')}&per_page=100`)).json()) as WpPost[])
    : await wpPostsByDate<WpPost>('_embed=wp:featuredmedia', AFTER, LIMIT)
  console.log(`Objava za obradu: ${posts.length}`)
  const started = Date.now()
  await pMap(
    posts,
    async (post, i) => {
      try {
        await importPost(post)
      } catch (e) {
        stats.failed++
        logErr(`POST ${post.id} ${post.link} ${(e as Error).message}`)
      }
      if ((i + 1) % 50 === 0) {
        const s = Math.round((Date.now() - started) / 1000)
        console.log(`  ${i + 1}/${posts.length} (${s}s) ${JSON.stringify(stats)}`)
      }
    },
    CONCURRENCY,
  )
  console.log('\nGotovo:', stats)
  if (stats.failed || stats.mediaFailed) console.log(`Greške su u ${logFile}`)
}

await main()
process.exit(stats.failed ? 1 : 0)
