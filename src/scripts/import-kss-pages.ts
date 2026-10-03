/**
 * Uvoz stranica sa kss.rs:
 *  - godišnje stranice reprezentacija (Seniori 2025, U16 kadeti 2024, 3×3…) → NationalTeam + TeamSeason + People
 *  - ostale stranice (Savez, Istorijat, Kontakt, Dokumenta…) → Pages
 *
 * npm run import:pages -- limit=10               # probni
 * npm run import:pages -- update media           # sve, sa fotografijama i prilozima
 * npm run import:pages -- only=teams|pages       # samo jedan deo
 *
 * Idempotentno po (tenant, legacyId). Osobe se spajaju po imenu + datumu rođenja.
 */
import config from '@payload-config'
import { JSDOM } from 'jsdom'
import { getPayload } from 'payload'
import type { Where } from 'payload'

import { slugify } from '../fields/slug'
import { createImportContext, decode, parseArgs, wpFetch } from './lib/wp'

const args = parseArgs()
const LIMIT = args.limit ? Number(args.limit) : Infinity
const WITH_MEDIA = args.media === 'true'
const UPDATE = args.update === 'true'
const ONLY = args.only as 'teams' | 'pages' | undefined
const ORIGIN = 'https://kss.rs'

// ---------------------------------------------------------------- klasifikacija
type TeamDef = { name: string; slug: string; gender: 'm' | 'f'; ageGroup: string; discipline: '5x5' | '3x3'; order: number }

/** prefiks slug-a stranice → reprezentacija */
const TEAM_DEFS: Record<string, TeamDef> = {
  seniori: { name: 'Muška seniorska reprezentacija', slug: 'seniori', gender: 'm', ageGroup: 'senior', discipline: '5x5', order: 10 },
  'u-20-mladi': { name: 'Muška U20 reprezentacija', slug: 'u20-mladi', gender: 'm', ageGroup: 'u20', discipline: '5x5', order: 20 },
  'u-19-mladi': { name: 'Muška U19 reprezentacija', slug: 'u19-mladi', gender: 'm', ageGroup: 'u19', discipline: '5x5', order: 30 },
  'u-18-juniori': { name: 'Muška U18 reprezentacija', slug: 'u18-juniori', gender: 'm', ageGroup: 'u18', discipline: '5x5', order: 40 },
  'u-17': { name: 'Muška U17 reprezentacija', slug: 'u17', gender: 'm', ageGroup: 'u17', discipline: '5x5', order: 50 },
  'u-16-kadeti': { name: 'Muška U16 reprezentacija', slug: 'u16-kadeti', gender: 'm', ageGroup: 'u16', discipline: '5x5', order: 60 },
  univerzitetska: { name: 'Univerzitetska reprezentacija', slug: 'univerzitetska', gender: 'm', ageGroup: 'university', discipline: '5x5', order: 70 },
  seniorke: { name: 'Ženska seniorska reprezentacija', slug: 'seniorke', gender: 'f', ageGroup: 'senior', discipline: '5x5', order: 110 },
  'u-20-mlade': { name: 'Ženska U20 reprezentacija', slug: 'u20-mlade', gender: 'f', ageGroup: 'u20', discipline: '5x5', order: 120 },
  'u-19-mlade': { name: 'Ženska U19 reprezentacija', slug: 'u19-mlade', gender: 'f', ageGroup: 'u19', discipline: '5x5', order: 130 },
  'u-18-juniorke': { name: 'Ženska U18 reprezentacija', slug: 'u18-juniorke', gender: 'f', ageGroup: 'u18', discipline: '5x5', order: 140 },
  'u-16-kadetkinje': { name: 'Ženska U16 reprezentacija', slug: 'u16-kadetkinje', gender: 'f', ageGroup: 'u16', discipline: '5x5', order: 160 },
  '3x3-seniori': { name: '3×3 seniori', slug: '3x3-seniori', gender: 'm', ageGroup: 'senior', discipline: '3x3', order: 210 },
  '3x3-seniorke': { name: '3×3 seniorke', slug: '3x3-seniorke', gender: 'f', ageGroup: 'senior', discipline: '3x3', order: 220 },
  '3x3-mladi': { name: '3×3 mladi', slug: '3x3-mladi', gender: 'm', ageGroup: 'youth', discipline: '3x3', order: 230 },
  '3x3-mlade': { name: '3×3 mlade', slug: '3x3-mlade', gender: 'f', ageGroup: 'youth', discipline: '3x3', order: 240 },
  '3x3-juniori': { name: '3×3 juniori', slug: '3x3-juniori', gender: 'm', ageGroup: 'junior', discipline: '3x3', order: 250 },
  '3x3-u17': { name: '3×3 U17', slug: '3x3-u17', gender: 'm', ageGroup: 'u17', discipline: '3x3', order: 260 },
}

const TEAM_SLUG = /^(.+)-(\d{4})$/
function classify(slug: string): { def: TeamDef; year: number } | null {
  const m = slug.match(TEAM_SLUG)
  if (!m) return null
  const def = TEAM_DEFS[m[1]]
  return def ? { def, year: Number(m[2]) } : null
}

/** Stranice koje ne selimo (kategorijske ljuske, probne, početna – frontend je gradi sam). */
const SKIP = /^(sample-page|sp_m_23|arhiva_interno|glavne-vesti|ostale-vesti|vesti-.+|.+-vesti|zenske-reprezentacije-vesti|dokumenta-star|dokumenta-2|naslovna)$/

// ------------------------------------------------------------------ parsiranje
const STAFF_ROLE: [RegExp, string][] = [
  [/head\s*coach|selektor|главни\s*тренер/i, 'head-coach'],
  [/assistant|помоћни/i, 'assistant'],
  [/director|директор|manager|менаџер/i, 'director'],
  [/doctor|лекар|physician/i, 'doctor'],
  [/physio|физио/i, 'physio'],
]
const BB_POSITION = /^(pg|sg|sf|pf|c|g|f|[1-5]|плејмејкер|плеј|бек|крило|крилни|центар|бекови|шутер)([\/,\s-]+(pg|sg|sf|pf|c|g|f|[1-5]|плејмејкер|плеј|бек|крило|крилни|центар|бекови|шутер))*$/i


type Card = { name: string; photo?: string; position?: string; birthDate?: string; birthYear?: number; heightCm?: number; club?: string; staff: boolean }

const textWithBreaks = (el: Element) =>
  el.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((l) => decode(l).replace(/\s+/g, ' ').trim())
    .filter(Boolean)

function parseBirth(s: string): string | undefined {
  const m = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/)
  if (!m) return undefined
  const [, d, mo, y] = m
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00.000Z`
  const dt = new Date(iso)
  // odbaci nepostojeće datume (npr. 31.02.) i očigledne greške u godini
  if (Number.isNaN(dt.getTime()) || dt.getUTCDate() !== Number(d) || Number(y) < 1930 || Number(y) > 2020) return undefined
  return iso
}

const LABEL_SPLIT = /(Позиција|Pozicija|Датум рођења|Datum rođenja|Годиште|Godište|Висина|Visina|Клуб|Klub|Број|Broj)\s*:/i
const LABEL_KEY: [RegExp, 'position' | 'birth' | 'birthYear' | 'height' | 'club' | 'number'][] = [
  [/^(позиција|pozicija)$/i, 'position'],
  [/^(датум рођења|datum rođenja)$/i, 'birth'],
  [/^(годиште|godište)$/i, 'birthYear'],
  [/^(висина|visina)$/i, 'height'],
  [/^(клуб|klub)$/i, 'club'],
  [/^(број|broj)$/i, 'number'],
]

/** Radi nad celim tekstom: "Позиција: C Датум рођења: 19.02.1995. Висина: 211 цм" i "Бек Датум рођења: 22.04.1991. Висина: 195 цм". */
function parseFields(dataEl: Element | null | undefined) {
  const text = dataEl ? textWithBreaks(dataEl).join(' ') : ''
  const parts = text.split(LABEL_SPLIT)
  const fields: Record<string, string> = {}
  if (parts[0].trim()) fields.position = parts[0].trim() // stariji oblik: pozicija bez oznake
  for (let i = 1; i < parts.length; i += 2) {
    const key = LABEL_KEY.find(([re]) => re.test(parts[i].trim()))?.[1]
    if (key) fields[key] = (parts[i + 1] ?? '').replace(/\s+/g, ' ').trim()
  }
  const birthDate = fields.birth ? parseBirth(fields.birth) : undefined
  const year = Number(fields.birthYear?.match(/\d{4}/)?.[0]) || (birthDate ? Number(birthDate.slice(0, 4)) : undefined)
  const heightCm = fields.height ? Number(fields.height.match(/\d{2,3}/)?.[0]) || undefined : undefined
  const club = fields.club && fields.club !== '–' && fields.club !== '-' ? fields.club : undefined
  const position = fields.position?.replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, '') || undefined
  return { position, club, birthDate, birthYear: year && year > 1930 && year < 2022 ? year : undefined, heightCm }
}

function parseCard(box: Element): Card | null {
  const nameEl = box.querySelector('.oneplayerboxnamearea')
  const name = nameEl ? textWithBreaks(nameEl).join(' ') : ''
  if (!name) return null
  const f = parseFields(box.querySelector('.oneplayerboxdataarea'))
  const img = box.querySelector('img')
  const photo = img?.getAttribute('data-orig-file') || img?.getAttribute('src') || undefined
  // štab: ima "Позиција" koja nije košarkaška pozicija (Селектор, Лекар…) i nema podatke o igraču;
  // igrač: ima datum rođenja/visinu/godište ili uopšte nema podatke (stare stranice: samo fotografija + ime)
  const hasPlayerData = Boolean(f.birthDate || f.heightCm || f.birthYear)
  const staff = !hasPlayerData && Boolean(f.position) && !BB_POSITION.test(f.position ?? '')
  return { name, photo, staff, ...f }
}

/** Starije stranice i 3×3: fotografija + ime ("Марко<br>Бранковић") bez klasa, ponekad sa "Позиција/Годиште/Клуб". */
function parseSimpleCards(doc: Document): Card[] {
  const out: Card[] = []
  for (const img of [...doc.querySelectorAll('img')]) {
    if (img.closest('.oneplayerbox')) continue
    const holder = img.parentElement
    const label = holder?.nextElementSibling
    if (!label || !label.querySelector('br')) continue
    const name = textWithBreaks(label).join(' ')
    if (!/^[\p{L}.'’ -]{4,40}$/u.test(name) || name.split(' ').length < 2) continue
    const next = label.nextElementSibling
    const f = next && /Позиција|Pozicija|Годиште|Клуб/i.test(next.textContent ?? '') ? parseFields(next) : {}
    out.push({ name, photo: img.getAttribute('data-orig-file') || img.getAttribute('src') || undefined, staff: false, ...f })
  }
  return out
}

const roleOf = (position = ''): { role: string; roleLabel: string } => ({
  role: STAFF_ROLE.find(([re]) => re.test(position))?.[1] ?? 'other',
  roleLabel: position,
})

// ------------------------------------------------------------------ glavni deo
type WpPage = { id: number; slug: string; link: string; title: { rendered: string }; content: { rendered: string }; parent: number }

async function fetchPages(): Promise<WpPage[]> {
  const all: WpPage[] = []
  for (let page = 1; ; page++) {
    const res = await wpFetch(`${ORIGIN}/wp-json/wp/v2/pages?per_page=50&page=${page}&_fields=id,slug,link,title,content,parent`)
    if (!res.ok) break
    const items = (await res.json()) as WpPage[]
    all.push(...items)
    if (items.length < 50) break
  }
  return all
}

const payload = await getPayload({ config })
const tenant = (await payload.find({ collection: 'tenants', where: { slug: { equals: 'kss' } }, limit: 1 })).docs[0]
if (!tenant) throw new Error('Sajt "kss" ne postoji. Pokreni: npm run seed')
const ctx = await createImportContext({ payload, tenantId: tenant.id, origin: ORIGIN, withMedia: WITH_MEDIA, label: 'kss-pages' })
const { stats, logErr, importMedia, htmlToBody } = ctx
Object.assign(stats, { teamSeasons: 0, people: 0, pages: 0, noParse: 0 })

const teamCache = new Map<string, number>()
async function ensureTeam(def: TeamDef): Promise<number> {
  const cached = teamCache.get(def.slug)
  if (cached) return cached
  const found = (
    await payload.find({ collection: 'national-teams', where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: def.slug } }] }, limit: 1, depth: 0 })
  ).docs[0]
  const doc =
    found ??
    (await payload.create({
      collection: 'national-teams',
      data: { name: def.name, slug: def.slug, gender: def.gender, ageGroup: def.ageGroup as never, discipline: def.discipline, order: def.order, tenant: tenant.id },
    }))
  teamCache.set(def.slug, doc.id)
  return doc.id
}

const personCache = new Map<string, number>()
async function ensurePerson(card: Card): Promise<number> {
  const key = `${slugify(card.name)}|${card.birthDate?.slice(0, 10) ?? ''}`
  const cached = personCache.get(key)
  if (cached) return cached
  const and: Where[] = [{ tenant: { equals: tenant.id } }, { slug: { equals: slugify(card.name) } }]
  if (card.birthDate) and.push({ birthDate: { equals: card.birthDate } })
  const where: Where = { and }
  const found = (await payload.find({ collection: 'people', where, limit: 1, depth: 0 })).docs[0]
  const photo = card.photo ? await importMedia(ctx.abs(card.photo), card.name) : null
  let id: number
  if (found) {
    id = found.id
    const patch: Record<string, unknown> = {}
    if (photo && !found.photo) patch.photo = photo
    if (card.birthDate && !found.birthDate) patch.birthDate = card.birthDate
    if (card.heightCm && !found.heightCm) patch.heightCm = card.heightCm
    if (card.birthYear && !found.birthYear) patch.birthYear = card.birthYear
    if (Object.keys(patch).length) await payload.update({ collection: 'people', id, data: patch })
  } else {
    const doc = await payload.create({
      collection: 'people',
      data: {
        fullName: card.name,
        slug: slugify(card.name),
        birthDate: card.birthDate,
        birthYear: card.birthYear,
        heightCm: card.heightCm,
        primaryPosition: card.staff ? undefined : card.position,
        photo: photo ?? undefined,
        tenant: tenant.id,
      },
    })
    id = doc.id
    stats.people++
  }
  personCache.set(key, id)
  return id
}

async function importTeamPage(page: WpPage, def: TeamDef, year: number) {
  const existing = (
    await payload.find({ collection: 'team-seasons', where: { and: [{ tenant: { equals: tenant.id } }, { legacyId: { equals: page.id } }] }, limit: 1, depth: 0 })
  ).docs[0]
  if (existing && !UPDATE) {
    stats.skipped++
    return
  }
  const doc = new JSDOM(`<body>${page.content.rendered}</body>`).window.document
  const boxes = [...doc.querySelectorAll('.oneplayerbox')]
  const boxCards = boxes.map(parseCard).filter((c): c is Card => Boolean(c))
  const simpleCards = parseSimpleCards(doc)
  const cards = [...simpleCards, ...boxCards] // igrači (obične kartice) pa štab (.oneplayerbox)
  const mode = `${boxCards.length ? 'boxes' : ''}${simpleCards.length ? '+simple' : ''}`

  // takmičenje: prvi <strong> (često podvučen) posle naslova, npr. "FIBA EuroBasket 2025"
  const compEl = [...doc.querySelectorAll('.fusion-text p strong, .fusion-text p b')].find((n) => /\d{4}|FIBA|EuroBasket|Eurobasket|EP|SP|Kvalifik|Квалиф|Првенств|Европск|Светск/i.test(n.textContent ?? ''))
  const competition = compEl ? decode(compEl.textContent ?? '').replace(/\s+/g, ' ').trim() : ''
  const pageTitle = decode(page.title.rendered).replace(/\s+/g, ' ').trim()

  const roster: { person: number; position?: string; clubAtTime?: string }[] = []
  const staff: { person: number; role: string; roleLabel?: string }[] = []
  for (const card of cards) {
    const person = await ensurePerson(card)
    if (card.staff) staff.push({ person, ...roleOf(card.position) })
    else roster.push({ person, position: card.position, clubAtTime: card.club })
  }

  // bez kartica (stare stranice sa tabelama): zadrži sadržaj tabela kao tekst
  let body: unknown
  if (!cards.length) {
    const tables = [...new Set([...doc.querySelectorAll('table')].map((t) => t.closest('.fusion-text') ?? t.parentElement ?? t))]
    if (tables.length) {
      // editor ne čuva tabele pri uvozu HTML-a: svaki red postaje jedan paragraf ("datum – mesto – opis")
      const flat = new JSDOM('<body></body>').window.document
      for (const tr of doc.querySelectorAll('table tr')) {
        const cells = [...tr.querySelectorAll('td, th')].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)
        if (!cells.length) continue
        const p = flat.createElement('p')
        p.textContent = cells.join(' – ')
        flat.body.appendChild(p)
      }
      body = (await htmlToBody(flat.body.innerHTML)).body
    } else {
      stats.noParse++
      logErr(`NO_PARSE ${page.slug} ${page.link}`)
    }
  }

  const data = {
    nationalTeam: await ensureTeam(def),
    year,
    title: competition || pageTitle,
    competitions: competition ? [{ name: competition }] : [],
    roster,
    staff: staff as never,
    body: body as never,
    tenant: tenant.id,
    legacyId: page.id,
    legacyUrl: page.link,
  }
  if (existing) {
    await payload.update({ collection: 'team-seasons', id: existing.id, data: data as never })
    stats.updated++
  } else {
    await payload.create({ collection: 'team-seasons', data: data as never })
    stats.created++
  }
  stats.teamSeasons++
  if (process.env.IMPORT_DEBUG) console.log(`  ${page.slug}: ${mode} roster=${roster.length} staff=${staff.length} "${competition || pageTitle}"`)
}

async function importGenericPage(page: WpPage) {
  const existing = (
    await payload.find({ collection: 'pages', where: { and: [{ tenant: { equals: tenant.id } }, { legacyId: { equals: page.id } }] }, limit: 1, depth: 0, draft: true })
  ).docs[0]
  if (existing && !UPDATE) {
    stats.skipped++
    return
  }
  const { body } = await htmlToBody(page.content.rendered)
  const data = {
    title: decode(page.title.rendered).replace(/\s+/g, ' ').trim() || page.slug,
    slug: page.slug,
    blocks: body ? [{ blockType: 'richText', content: body }] : [],
    tenant: tenant.id,
    legacyId: page.id,
    legacyUrl: page.link,
    legacyHtml: page.content.rendered,
    _status: 'published' as const,
  }
  if (existing) {
    await payload.update({ collection: 'pages', id: existing.id, data: data as never, draft: false })
    stats.updated++
  } else {
    await payload.create({ collection: 'pages', data: data as never })
    stats.created++
  }
  stats.pages++
}

console.log(`Uvoz stranica kss.rs: limit=${LIMIT} media=${WITH_MEDIA} update=${UPDATE} only=${ONLY ?? 'sve'}`)
const pages = (await fetchPages()).slice(0, LIMIT === Infinity ? undefined : LIMIT)
console.log(`Stranica: ${pages.length}`)

for (const page of pages) {
  try {
    const team = classify(page.slug)
    if (team) {
      if (ONLY !== 'pages') await importTeamPage(page, team.def, team.year)
    } else if (!SKIP.test(page.slug)) {
      if (ONLY !== 'teams') await importGenericPage(page)
    } else {
      stats.skipped++
    }
  } catch (e) {
    stats.failed++
    logErr(`PAGE ${page.id} ${page.slug} ${(e as Error).message}`)
  }
}

console.log('\nGotovo:', stats)
if (stats.failed || stats.mediaFailed || stats.noParse) console.log(`Detalji su u ${ctx.logFile}`)
process.exit(stats.failed ? 1 : 0)
