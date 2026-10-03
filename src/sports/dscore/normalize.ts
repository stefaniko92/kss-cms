/**
 * DScore → naš javni model.
 *
 * PRIVATNOST: izvor vraća e-mailove sudija/delegata, telefone i kontakt osobe klubova.
 * Ovde se NIKAD ne kopira ceo objekat; polja se biraju jedno po jedno (allowlist).
 * Ako DScore doda novo polje, ono ne prolazi dok ga ovde ne dodamo ručno.
 */
import type {
  League,
  LeagueGroup,
  Match,
  MatchDetail,
  MatchStatus,
  PlayerLine,
  PlayEvent,
  StandingRow,
  Standings,
  TeamBox,
  TeamRef,
} from '../types'

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

// ------------------------------------------------------------------ liga / kategorije
export function normalizeCategories(raw: unknown): LeagueGroup[] {
  return arr(obj(raw).categories).map((c) => {
    const cat = obj(c)
    return {
      id: num(cat.id),
      label: str(cat.label) ?? '',
      leagues: arr(cat.leagues).map((l) => ({ id: num(obj(l).id), name: str(obj(l).name) ?? '' })),
    }
  })
}

export function normalizeLeague(raw: unknown, category?: { id: number; label: string } | null): League {
  const l = obj(raw)
  return {
    id: num(l.id),
    name: str(l.name) ?? '',
    startDate: str(l.start_date),
    visible: Boolean(l.is_visible),
    teamsCount: numOrNull(l.teams_count) ?? (Array.isArray(l.teams) ? l.teams.length : null),
    categoryId: category?.id ?? numOrNull(obj(l.category).id),
    categoryLabel: category?.label ?? str(obj(l.category).name),
    kssLiveSlug: str(l.kss_live_slug),
    statsEnabled: Boolean(l.kss_statistics_enabled),
  }
}

// ------------------------------------------------------------------ timovi i utakmice
export function normalizeTeam(raw: unknown): TeamRef {
  const t = obj(raw)
  // NAMERNO izostavljeno: email, phone, contact_person, ebr, link, youtube_stream_id…
  return {
    id: num(t.id),
    name: str(t.name) ?? '',
    logo: str(t.logo),
    clubId: numOrNull(t.team_club_id),
    city: str(t.city),
  }
}

const sumPeriods = (s: Raw, side: 'A' | 'B') => num(s[`${side}1`]) + num(s[`${side}2`]) + num(s[`${side}3`]) + num(s[`${side}4`]) + num(s[`${side}_extra`])

/**
 * DScore polje `status` ostaje "scheduled" i za završene utakmice, pa status izvodimo:
 * pobednik postoji → završena; ima rezultat, počela je u poslednja 3 sata → uživo.
 */
export function deriveStatus(args: { winner: unknown; hasScore: boolean; startsAt: string; forfeit: boolean; now?: Date }): MatchStatus {
  const now = args.now ?? new Date()
  if (args.winner || args.forfeit) return 'finished'
  const start = new Date(args.startsAt).getTime()
  if (args.hasScore && Number.isFinite(start) && now.getTime() >= start && now.getTime() < start + 3 * 3600_000) return 'live'
  return 'scheduled'
}

export function normalizeMatch(raw: unknown, leagueId: number, now?: Date): Match {
  const c = obj(raw)
  const score = c.score ? obj(c.score) : null
  const startsAt = str(c.time) ?? ''
  const forfeit = Boolean(c.is_forfeit)
  const status = deriveStatus({ winner: c.winner, hasScore: Boolean(score), startsAt, forfeit, now })
  const showScore = score && status !== 'scheduled'
  const arena = c.arena ? obj(c.arena) : null
  const quarters = (side: 'A' | 'B') => (score ? [1, 2, 3, 4].map((i) => num(score[`${side}${i}`])) : [])
  const referees = [c.first_referee, c.second_referee, c.third_referee].map((r) => str(obj(r).name)).filter((x): x is string => Boolean(x))

  return {
    id: num(c.id),
    leagueId,
    round: numOrNull(c.round),
    roundLabel: str(c.round_description),
    startsAt,
    status,
    forfeit,
    home: { ...normalizeTeam(c.first_team), score: showScore ? sumPeriods(score, 'A') : null },
    away: { ...normalizeTeam(c.second_team), score: showScore ? sumPeriods(score, 'B') : null },
    periods: showScore
      ? { home: quarters('A'), away: quarters('B'), overtimeHome: num(score.A_extra), overtimeAway: num(score.B_extra) }
      : null,
    venue: arena
      ? { name: str(arena.name) ?? '', city: str(arena.city), lat: numOrNull(arena.lat), lng: numOrNull(arena.lng) }
      : null,
    officials: { referees, delegate: str(obj(c.delegate).name) },
    // link_live je YouTube prenos; link_stat (kss-live) ne izlažemo
    links: { video: str(c.link_live) },
  }
}

export function normalizeSchedule(rawLeague: unknown, now?: Date): { league: League; matches: Match[]; teams: TeamRef[] } {
  const l = obj(rawLeague)
  const league = normalizeLeague(l)
  const matches = arr(l.contests).map((c) => normalizeMatch(c, league.id, now))
  matches.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id)
  return { league, matches, teams: arr(l.teams).map(normalizeTeam) }
}

// ------------------------------------------------------------------ tabela
const normalizeRow = (raw: unknown): StandingRow => {
  const r = obj(raw)
  return {
    position: num(r.position),
    teamId: num(r.id),
    name: str(r.name) ?? '',
    logo: str(r.logo),
    played: num(r.games),
    wins: num(r.wins),
    losses: num(r.lost),
    pointsFor: num(r.goals_for),
    pointsAgainst: num(r.goals_against),
    diff: num(r.goals_difference),
    points: num(r.points),
  }
}

export function normalizeStandings(raw: unknown): Standings {
  const s = obj(raw)
  return {
    leagueId: num(obj(s.league).id),
    leagueName: str(obj(s.league).name) ?? '',
    rows: arr(s.standings).map(normalizeRow),
    miniTables: arr(s.mini_standings).map((g) => arr(g).map(normalizeRow)),
  }
}

// ------------------------------------------------------------------ box score
const toSeconds = (v: unknown): number => {
  const m = String(v ?? '').match(/^(\d+):(\d{1,2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

type Stats = Omit<PlayerLine, 'playerId' | 'name' | 'number' | 'starter'>

/**
 * Značenje kolona (potvrđeno na utakmici: zbir `po` = rezultat, `23pu` = `2pu`+`3pu`):
 * po=poeni, 1p=slobodna, 2p/3p=šut za 2/3, 23p=iz igre, skn/sko=skok napad/odbrana, os=osvojene lopte,
 * iz=izgubljene, as=asistencije, bl=blokade, bln=blokade nad njim, lg=lične greške, lgn=primljene greške, ind=indeks.
 */
const normalizeStats = (r: Raw): Stats => ({
  seconds: toSeconds(r.min),
  points: num(r.po),
  ftm: num(r['1pu']),
  fta: num(r['1pp']),
  fg2m: num(r['2pu']),
  fg2a: num(r['2pp']),
  fg3m: num(r['3pu']),
  fg3a: num(r['3pp']),
  fgm: num(r['23pu']),
  fga: num(r['23pp']),
  offReb: num(r.skn),
  defReb: num(r.sko),
  reb: num(r.skn) + num(r.sko),
  assists: num(r.as),
  steals: num(r.os),
  turnovers: num(r.iz),
  blocks: num(r.bl),
  blocksAgainst: num(r.bln),
  fouls: num(r.lg),
  foulsDrawn: num(r.lgn),
  index: num(r.ind),
})

const normalizePlayer = (raw: unknown): PlayerLine => {
  const r = obj(raw)
  return {
    playerId: str(r.igrac_id),
    name: str(r.igrac_ime) ?? '',
    number: str(r.dres),
    starter: str(r.starter) === '*',
    ...normalizeStats(r),
  }
}

function normalizeSide(box: Raw, prefix: 'd' | 'g', team: Raw): TeamBox & { logo: string | null } {
  const periods = [1, 2, 3, 4].map((i) => num(box[`${prefix}_${i}c`]))
  return {
    name: str(box[`${prefix}_naziv`]) ?? str(team.name) ?? '',
    logo: str(team.logo),
    score: num(box[`${prefix}_rez`]),
    periods,
    overtime: num(box[`${prefix}_pr`]),
    players: arr(box[`${prefix}_igraci`]).map(normalizePlayer),
    totals: normalizeStats(obj(box[`${prefix}_ukupno`])),
  }
}

export function normalizeMatchDetail(raw: unknown, now?: Date): MatchDetail {
  const m = obj(raw)
  const box = obj(m.boxscore)
  const league = obj(m.league)
  const startsAt = str(m.time) ?? ''
  const home = normalizeSide(box, 'd', obj(m.first_team))
  const away = normalizeSide(box, 'g', obj(m.second_team))
  // završena: ima rezultat i nema izjednačenja, a ili je prošlo 3 h od starta ili je odigrano 40+ minuta
  // (`box.status` = odigrani minuti; za stare utakmice nije pouzdan)
  const started = new Date(startsAt).getTime()
  const longAgo = Number.isFinite(started) && (now ?? new Date()).getTime() > started + 3 * 3600_000
  const finished = home.score + away.score > 0 && home.score !== away.score && (longAgo || num(box.status) >= 40)
  const status = deriveStatus({
    winner: finished ? true : null,
    hasScore: home.score + away.score > 0,
    startsAt,
    forfeit: false,
    now,
  })
  return {
    id: num(m.id),
    leagueId: num(league.id),
    leagueName: str(league.name) ?? '',
    round: numOrNull(m.round),
    startsAt,
    status,
    attendance: numOrNull(box.gledalaca),
    officials: {
      referees: [box.sudija1, box.sudija2, box.sudija3].map(str).filter((x): x is string => Boolean(x)),
      delegate: str(box.delegat),
    },
    home,
    away,
    playByPlay: arr(m.pbp).map(
      (e): PlayEvent => ({ type: num(obj(e).tip), minute: num(obj(e).min), score: str(obj(e).rez) ?? '', text: str(obj(e).akc) ?? '' }),
    ),
  }
}
