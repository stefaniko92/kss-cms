/**
 * Sinhronizacija sa DScore-om.
 *
 * npm run sync:sports -- phases                 # Competition / Season / CompetitionPhase za sajt "lige" iz DScore kategorija
 * npm run sync:sports -- stats league=184       # preuzmi sve odigrane utakmice lige u keš (za statistiku igrača)
 * npm run sync:sports -- stats all              # sve vidljive lige
 *
 * Parametri se zadaju bez "--" (payload run ih guta).
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { isBlocked } from '../sports/dscore/client'
import { getAllLeagues, getLeagueGroups, syncLeagueMatches } from '../sports/service'
import type { League } from '../sports/types'

const args = process.argv.slice(2).filter((a) => a !== '--')
const mode = args.find((a) => !a.includes('='))
const opt = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.split('=') as [string, string]))

const payload = await getPayload({ config })

/** Ime lige → grupa takmičenja na sajtu. */
const GROUP_BY_CATEGORY: Record<string, string> = {
  Seniori: 'seniori',
  Seniorke: 'seniorke',
  'Mlađe kategorije': 'mladje-kategorije',
  '1.MRL': 'seniori',
  '2.MRL': 'seniori',
  '3.MRL': 'seniori',
  '1.ŽRL': 'seniorke',
}

const isFemale = (leagueName: string, categoryLabel: string) => /ž/i.test(leagueName) || /ž/i.test(categoryLabel) || categoryLabel === 'Seniorke'

/** "2026/27" iz datuma početka (jul i kasnije = nova sezona). */
const seasonLabel = (startDate: string | null): string | null => {
  if (!startDate) return null
  const d = new Date(startDate)
  const y = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`
}

async function syncPhases() {
  const tenant = (await payload.find({ collection: 'tenants', where: { slug: { equals: 'lige' } }, limit: 1 })).docs[0]
  if (!tenant) throw new Error('Sajt "lige" ne postoji. Pokreni: npm run seed')

  const groups = await getLeagueGroups()
  const all = new Map((await getAllLeagues()).map((l) => [l.id, l]))
  const stats = { competitions: 0, seasons: 0, phases: 0, updated: 0 }

  const seasonCache = new Map<string, number>()
  const ensureSeason = async (label: string, league: League) => {
    const cached = seasonCache.get(label)
    if (cached) return cached
    const found = (await payload.find({ collection: 'seasons', where: { and: [{ tenant: { equals: tenant.id } }, { label: { equals: label } }] }, limit: 1, depth: 0 })).docs[0]
    const doc = found ?? (await payload.create({ collection: 'seasons', data: { label, startDate: league.startDate ?? undefined, tenant: tenant.id } }))
    if (!found) stats.seasons++
    seasonCache.set(label, doc.id)
    return doc.id
  }

  let order = 0
  for (const group of groups) {
    for (const entry of group.leagues) {
      order += 10
      const league = all.get(entry.id)
      const label = seasonLabel(league?.startDate ?? null)
      if (!league || !label) continue

      const slug = entry.name.toLowerCase().replace(/[^a-z0-9ž]+/gi, '-').replace(/^-|-$/g, '')
      const found = (await payload.find({ collection: 'competitions', where: { and: [{ tenant: { equals: tenant.id } }, { name: { equals: entry.name } }] }, limit: 1, depth: 0 })).docs[0]
      const competition =
        found ??
        (await payload.create({
          collection: 'competitions',
          data: {
            name: entry.name,
            slug,
            group: (GROUP_BY_CATEGORY[group.label] ?? 'seniori') as never,
            gender: isFemale(entry.name, group.label) ? 'f' : 'm',
            dscoreCategoryId: group.id,
            order,
            tenant: tenant.id,
          },
        }))
      if (!found) stats.competitions++
      else if (found.gender !== (isFemale(entry.name, group.label) ? 'f' : 'm')) await payload.update({ collection: 'competitions', id: found.id, data: { gender: isFemale(entry.name, group.label) ? 'f' : 'm' } })

      const season = await ensureSeason(label, league)
      const existing = (
        await payload.find({ collection: 'competition-phases', where: { and: [{ tenant: { equals: tenant.id } }, { dscoreLeagueId: { equals: entry.id } }] }, limit: 1, depth: 0 })
      ).docs[0]
      const data = {
        competition: competition.id,
        season,
        name: 'Regularni deo',
        type: 'regular' as const,
        dscoreLeagueId: entry.id,
        statsSource: league.statsEnabled ? ('kss-live' as const) : ('dscore' as const),
        kssLiveSlug: league.kssLiveSlug ?? undefined,
        order,
        published: true,
        tenant: tenant.id,
      }
      if (existing) {
        await payload.update({ collection: 'competition-phases', id: existing.id, data })
        stats.updated++
      } else {
        await payload.create({ collection: 'competition-phases', data })
        stats.phases++
      }
    }
  }

  // tekuća sezona = najnovija
  const seasons = (await payload.find({ collection: 'seasons', where: { tenant: { equals: tenant.id } }, sort: '-startDate', limit: 50, depth: 0 })).docs
  for (const [i, s] of seasons.entries()) {
    if (Boolean(s.current) !== (i === 0)) await payload.update({ collection: 'seasons', id: s.id, data: { current: i === 0 } })
  }
  console.log('Faze:', stats)
}

async function syncStats() {
  const leagues = opt.league ? [Number(opt.league)] : args.includes('all') ? (await getAllLeagues()).filter((l) => l.visible).map((l) => l.id) : []
  if (!leagues.length) throw new Error('Navedi league=ID ili all')
  for (const id of leagues) {
    let total = 0
    const skip = new Set<number>()
    for (;;) {
      const { fetched, failed, remaining } = await syncLeagueMatches(id, { max: 40, concurrency: 4, skip })
      failed.forEach((f) => skip.add(f))
      total += fetched
      console.log(`liga ${id}: +${fetched}, neuspelo ${failed.length} (preostalo ${remaining})`)
      if (isBlocked()) {
        console.error('DScore je blokirao zahteve (provera posetioca). Prekidam; pokreni ponovo kasnije.')
        process.exit(2)
      }
      if (remaining <= 0) break
    }
    console.log(`liga ${id}: ukupno preuzeto ${total}${skip.size ? `, preskočeno ${skip.size}: ${[...skip].slice(0, 20).join(',')}` : ''}`)
  }
}

if (mode === 'phases') await syncPhases()
else if (mode === 'stats') await syncStats()
else {
  console.error('Koristi: npm run sync:sports -- phases | stats league=ID | stats all')
  process.exit(1)
}
process.exit(0)
