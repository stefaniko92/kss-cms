import config from '@payload-config'
import { getPayload } from 'payload'

import { cached } from './cache'
import { dscoreGet, type Lane } from './dscore/client'
import {
  normalizeCategories,
  normalizeLeague,
  normalizeMatchDetail,
  normalizeSchedule,
  normalizeStandings,
} from './dscore/normalize'
import type { League, LeaderRow, LeagueGroup, Match, MatchDetail, Standings, TeamRef } from './types'

// ------------------------------------------------------------------ TTL (sekunde)
const TTL = {
  leagues: 3600,
  standings: 120,
  schedule: 120,
  matchLive: 15,
  matchScheduled: 300,
  matchFinished: 30 * 24 * 3600,
  leaders: 600,
} as const

// ------------------------------------------------------------------ liste liga
export async function getLeagueGroups(): Promise<LeagueGroup[]> {
  const { data } = await cached<LeagueGroup[]>({
    key: 'categories',
    kind: 'leagues',
    ttl: TTL.leagues,
    fetcher: async () => normalizeCategories(await dscoreGet('categories')),
  })
  return data
}

/** Sve lige iz DScore-a (i stare sezone), paginirano. */
export async function getAllLeagues(): Promise<League[]> {
  const { data } = await cached<League[]>({
    key: 'leagues:all',
    kind: 'leagues',
    ttl: TTL.leagues,
    fetcher: async () => {
      const first = await dscoreGet<{ data: unknown[]; meta?: { last_page?: number } }>('leagues?page=1')
      const last = first.meta?.last_page ?? 1
      const rest = await Promise.all(Array.from({ length: Math.max(0, last - 1) }, (_, i) => dscoreGet<{ data: unknown[] }>(`leagues?page=${i + 2}`)))
      return [first, ...rest].flatMap((p) => p.data.map((l) => normalizeLeague(l)))
    },
  })
  return data
}

// ------------------------------------------------------------------ jedna liga
type ScheduleData = { league: League; matches: Match[]; teams: TeamRef[] }

export async function getSchedule(leagueId: number, lane: Lane = 'live'): Promise<ScheduleData> {
  const { data } = await cached<ScheduleData>({
    key: `schedule:${leagueId}`,
    kind: 'schedule',
    leagueId,
    ttl: TTL.schedule,
    fetcher: async () => normalizeSchedule(await dscoreGet(`leagues/${leagueId}`, { lane })),
  })
  return data
}

export async function getStandings(leagueId: number): Promise<Standings> {
  const { data } = await cached<Standings>({
    key: `standings:${leagueId}`,
    kind: 'standings',
    leagueId,
    ttl: TTL.standings,
    fetcher: async () => normalizeStandings(await dscoreGet(`leagues/${leagueId}/standings`)),
  })
  return data
}

// ------------------------------------------------------------------ utakmica
export async function getMatch(matchId: number, lane: Lane = 'live'): Promise<MatchDetail> {
  const { data } = await cached<MatchDetail>({
    key: `match:${matchId}`,
    kind: 'match',
    ttl: (m) => (m.status === 'finished' ? TTL.matchFinished : m.status === 'live' ? TTL.matchLive : TTL.matchScheduled),
    finished: (m) => m.status === 'finished',
    fetcher: async () => normalizeMatchDetail(await dscoreGet(`contests/${matchId}/statistics`, { lane })),
  })
  return data
}

// ------------------------------------------------------------------ statistika igrača
const STAT_KEYS = [
  'points', 'reb', 'offReb', 'defReb', 'assists', 'steals', 'blocks', 'turnovers', 'fouls', 'index',
  'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'seconds',
] as const

export const LEADER_STATS = ['points', 'reb', 'assists', 'steals', 'blocks', 'index', 'fg3m'] as const
export type LeaderStat = (typeof LEADER_STATS)[number]

/** Odigrane utakmice lige koje još nemamo u kešu (za bulk i pozadinsku sinhronizaciju). */
export async function syncLeagueMatches(
  leagueId: number,
  opts: { max?: number; concurrency?: number; skip?: Set<number> } = {},
): Promise<{ fetched: number; failed: number[]; remaining: number }> {
  const { max = 25, concurrency = 4, skip = new Set<number>() } = opts
  const payload = await getPayload({ config })
  const schedule = await getSchedule(leagueId, 'bulk')
  const finishedIds = schedule.matches.filter((m) => m.status === 'finished').map((m) => m.id)
  if (!finishedIds.length) return { fetched: 0, failed: [], remaining: 0 }

  const have = new Set<number>()
  for (let i = 0; i < finishedIds.length; i += 200) {
    const slice = finishedIds.slice(i, i + 200).map((id) => `match:${id}`)
    const res = await payload.find({
      collection: 'sports-cache',
      where: { and: [{ key: { in: slice } }, { finished: { equals: true } }] },
      limit: 200,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    res.docs.forEach((d) => have.add(Number(d.key.slice(6))))
  }
  const missing = finishedIds.filter((id) => !have.has(id) && !skip.has(id))
  const batch = missing.slice(0, max)
  const failed: number[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
      while (next < batch.length) {
        const id = batch[next++]
        try {
          const detail = await getMatch(id, 'bulk')
          // nije prepoznata kao završena (npr. nerešen/prazan box score) → ne računamo je kao dobijenu
          if (detail.status !== 'finished') failed.push(id)
        } catch {
          failed.push(id) // jedna loša utakmica ne sme da obori sinhronizaciju
        }
      }
    }),
  )
  return { fetched: batch.length - failed.length, failed, remaining: missing.length - batch.length }
}

const syncing = new Set<number>()

export async function getLeaders(leagueId: number, opts: { stat?: LeaderStat; limit?: number; minGames?: number; perGame?: boolean } = {}) {
  const { stat = 'points', limit = 20, minGames = 1, perGame = true } = opts
  const payload = await getPayload({ config })
  const schedule = await getSchedule(leagueId)
  const finished = schedule.matches.filter((m) => m.status === 'finished')

  // pozadinski dopuna keša (ne čekamo je)
  if (!syncing.has(leagueId)) {
    syncing.add(leagueId)
    void syncLeagueMatches(leagueId, { max: 25 })
      .catch(() => null)
      .finally(() => syncing.delete(leagueId))
  }

  const ids = finished.map((m) => `match:${m.id}`)
  const docs: { data: MatchDetail }[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const res = await payload.find({
      collection: 'sports-cache',
      where: { key: { in: ids.slice(i, i + 100) } },
      limit: 100,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    docs.push(...(res.docs as unknown as { data: MatchDetail }[]))
  }

  const teamIdByName = new Map<string, number>()
  for (const m of schedule.matches) {
    teamIdByName.set(m.home.name.toLowerCase(), m.home.id)
    teamIdByName.set(m.away.name.toLowerCase(), m.away.id)
  }

  const acc = new Map<string, LeaderRow>()
  for (const { data: match } of docs) {
    for (const side of [match.home, match.away]) {
      for (const p of side.players) {
        if (!p.name || p.seconds <= 0) continue // nije igrao
        const key = `${side.name}|${p.playerId ?? p.name}`
        const row =
          acc.get(key) ??
          ({
            name: p.name,
            teamId: teamIdByName.get(side.name.toLowerCase()) ?? null,
            teamName: side.name,
            games: 0,
            totals: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
            perGame: {},
          } satisfies LeaderRow)
        row.games++
        for (const k of STAT_KEYS) row.totals[k] += p[k]
        acc.set(key, row)
      }
    }
  }

  const rows = [...acc.values()]
    .filter((r) => r.games >= minGames)
    .map((r) => ({
      ...r,
      perGame: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.round((r.totals[k] / r.games) * 10) / 10])),
    }))
    .sort((a, b) => (perGame ? b.perGame[stat] - a.perGame[stat] : b.totals[stat] - a.totals[stat]) || b.totals[stat] - a.totals[stat])
    .slice(0, limit)

  return { leagueId, stat, perGame, gamesCounted: docs.length, gamesFinished: finished.length, rows }
}
