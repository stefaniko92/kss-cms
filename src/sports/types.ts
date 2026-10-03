/** Javni (normalizovani) model sportskih podataka. Ovo je jedino što napušta backend. */

export type MatchStatus = 'scheduled' | 'live' | 'finished'

export type TeamRef = { id: number; name: string; logo: string | null; clubId: number | null; city: string | null }

export type Match = {
  id: number
  leagueId: number
  round: number | null
  roundLabel: string | null
  startsAt: string
  status: MatchStatus
  forfeit: boolean
  home: TeamRef & { score: number | null }
  away: TeamRef & { score: number | null }
  /** rezultat po četvrtinama; overtime = ukupno poena u produžecima */
  periods: { home: number[]; away: number[]; overtimeHome: number; overtimeAway: number } | null
  venue: { name: string; city: string | null; lat: number | null; lng: number | null } | null
  officials: { referees: string[]; delegate: string | null }
  links: { video: string | null }
}

export type League = {
  id: number
  name: string
  startDate: string | null
  visible: boolean
  teamsCount: number | null
  categoryId: number | null
  categoryLabel: string | null
  kssLiveSlug: string | null
  statsEnabled: boolean
}

export type LeagueGroup = { id: number; label: string; leagues: { id: number; name: string }[] }

export type StandingRow = {
  position: number
  teamId: number
  name: string
  logo: string | null
  played: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  diff: number
  points: number
}

export type Standings = { leagueId: number; leagueName: string; rows: StandingRow[]; miniTables: StandingRow[][] }

export type PlayerLine = {
  playerId: string | null
  name: string
  number: string | null
  starter: boolean
  seconds: number
  points: number
  ftm: number
  fta: number
  fg2m: number
  fg2a: number
  fg3m: number
  fg3a: number
  fgm: number
  fga: number
  offReb: number
  defReb: number
  reb: number
  assists: number
  steals: number
  turnovers: number
  blocks: number
  blocksAgainst: number
  fouls: number
  foulsDrawn: number
  index: number
}

export type TeamBox = {
  name: string
  score: number
  periods: number[]
  overtime: number
  players: PlayerLine[]
  totals: Omit<PlayerLine, 'playerId' | 'name' | 'number' | 'starter'>
}

export type PlayEvent = { type: number; minute: number; score: string; text: string }

export type MatchDetail = {
  id: number
  leagueId: number
  leagueName: string
  round: number | null
  startsAt: string
  status: MatchStatus
  attendance: number | null
  officials: { referees: string[]; delegate: string | null }
  home: TeamBox & { logo: string | null }
  away: TeamBox & { logo: string | null }
  /** najnoviji događaj prvi, kao u izvoru */
  playByPlay: PlayEvent[]
}

export type LeaderRow = {
  name: string
  teamId: number | null
  teamName: string
  games: number
  totals: Record<string, number>
  perGame: Record<string, number>
}
