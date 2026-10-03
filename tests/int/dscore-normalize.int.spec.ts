import { describe, expect, it } from 'vitest'

import { deriveStatus, normalizeMatch, normalizeMatchDetail, normalizeStandings, normalizeTeam } from '../../src/sports/dscore/normalize'

// Izmišljeni podaci; obavezno uključuju privatna polja koja izvor vraća.
const team = (id: number, name: string) => ({
  id,
  name,
  logo: `https://x/${id}.png`,
  team_club_id: id * 10,
  city: 'Niš',
  email: `klub${id}@example.com`,
  phone: '0641234567',
  contact_person: 'Petar Petrović 0652296375',
  ebr: '0806211016',
  link: 'https://private.example',
})

const contest = (over: Record<string, unknown> = {}) => ({
  id: 1,
  round: 3,
  time: '2026-10-02T17:00:00.000000Z',
  status: 'scheduled',
  first_team: team(1, 'Alfa'),
  second_team: team(2, 'Beta'),
  score: { A1: 13, A2: 23, A3: 22, A4: 22, A_extra: 0, B1: 13, B2: 23, B3: 14, B4: 17, B_extra: 0 },
  winner: team(1, 'Alfa'),
  arena: { name: 'Hala', city: 'Niš', lat: 43.3, lng: 21.9, address: 'tajna adresa 1' },
  first_referee: { id: 1, name: 'Sudija A.', email: 'a@example.com' },
  second_referee: { id: 2, name: 'Sudija B.', email: 'b@example.com' },
  third_referee: null,
  delegate: { id: 3, name: 'Delegat D.', email: 'd@example.com' },
  link_live: 'https://youtu.be/abc',
  link_stat: 'https://kss-live.com/x',
  is_forfeit: null,
  ...over,
})

describe('privatnost', () => {
  it('normalizeTeam ne propušta e-mail, telefon, kontakt osobu', () => {
    const out = JSON.stringify(normalizeTeam(team(1, 'Alfa')))
    expect(out).not.toMatch(/example\.com|0641234567|Petrović|0652296375|0806211016|private/)
    expect(Object.keys(normalizeTeam(team(1, 'Alfa'))).sort()).toEqual(['city', 'clubId', 'id', 'logo', 'name'])
  })

  it('normalizeMatch ne propušta e-mailove sudija/delegata ni adresu hale', () => {
    const out = JSON.stringify(normalizeMatch(contest(), 284))
    expect(out).not.toMatch(/@|0641234567|tajna adresa|kss-live/)
    expect(out).toContain('Sudija A.') // imena su javna (kao na DScore stranici)
  })

  it('ne propušta nepoznata nova polja izvora', () => {
    const out = normalizeMatch(contest({ novo_privatno_polje: 'tajna' }), 284)
    expect(JSON.stringify(out)).not.toContain('tajna')
  })
})

describe('utakmica', () => {
  it('računa rezultat iz četvrtina i produžetaka', () => {
    const m = normalizeMatch(contest({ score: { A1: 10, A2: 10, A3: 10, A4: 10, A_extra: 5, B1: 10, B2: 10, B3: 10, B4: 10, B_extra: 0 } }), 1)
    expect(m.home.score).toBe(45)
    expect(m.away.score).toBe(40)
    expect(m.periods?.overtimeHome).toBe(5)
  })

  it('status: pobednik → završena, DScore "scheduled" se ignoriše', () => {
    expect(normalizeMatch(contest(), 1, new Date('2026-10-03T00:00:00Z')).status).toBe('finished')
  })

  it('status: bez pobednika, rezultat i počelo pre 1 h → uživo', () => {
    const now = new Date('2026-10-02T18:00:00Z')
    expect(normalizeMatch(contest({ winner: null }), 1, now).status).toBe('live')
  })

  it('status: zakazana ne izlaže rezultat', () => {
    const m = normalizeMatch(contest({ winner: null, score: null }), 1, new Date('2026-10-01T00:00:00Z'))
    expect(m.status).toBe('scheduled')
    expect(m.home.score).toBeNull()
    expect(m.periods).toBeNull()
  })

  it('deriveStatus: bez rezultata posle 3 h nije uživo', () => {
    expect(deriveStatus({ winner: null, hasScore: true, startsAt: '2026-10-02T10:00:00Z', forfeit: false, now: new Date('2026-10-02T20:00:00Z') })).toBe('scheduled')
  })
})

describe('tabela', () => {
  it('pretvara stringove u brojeve', () => {
    const s = normalizeStandings({
      league: { id: 5, name: 'Liga' },
      standings: [{ position: 1, id: 7, name: 'Alfa', logo: null, games: '30', wins: '28', lost: '2', points: '58', goals_for: '2608', goals_against: '2195', goals_difference: '413', email: 'x@example.com' }],
      mini_standings: [],
    })
    expect(s.rows[0]).toMatchObject({ played: 30, wins: 28, losses: 2, points: 58, pointsFor: 2608, diff: 413 })
    expect(JSON.stringify(s)).not.toContain('@')
  })
})

describe('box score', () => {
  const raw = {
    id: 9,
    round: 1,
    time: '2026-10-02T17:00:00Z',
    league: { id: 284, name: '2.MLS' },
    first_team: { name: 'Alfa', logo: null },
    second_team: { name: 'Beta', logo: null },
    boxscore: {
      status: '40',
      gledalaca: '400',
      sudija1: 'Sudija A.',
      delegat: 'Delegat D.',
      d_naziv: 'ALFA',
      g_naziv: 'BETA',
      d_rez: '80',
      g_rez: '67',
      d_1c: '13', d_2c: '23', d_3c: '22', d_4c: '22', d_pr: '',
      g_1c: '13', g_2c: '23', g_3c: '14', g_4c: '17', g_pr: '',
      d_igraci: [{ igrac_id: '', igrac_ime: 'Prvi Igrač', dres: '7', starter: '*', min: '14:59', po: '12', skn: '2', sko: '3', as: '1', os: '2', iz: '1', bl: '0', bln: '0', lg: '3', lgn: '2', ind: '9', '1pu': '2', '1pp': '3', '2pu': '3', '2pp': '5', '3pu': '1', '3pp': '4', '23pu': '4', '23pp': '9' }],
      g_igraci: [],
      d_ukupno: { po: '80' },
      g_ukupno: { po: '67' },
    },
    pbp: [{ tip: '3', min: '40', rez: '80:67', akc: 'kraj utakmice' }],
  }

  it('mapira kolone i minute', () => {
    const d = normalizeMatchDetail(raw, new Date('2026-10-03T00:00:00Z'))
    const p = d.home.players[0]
    expect(p).toMatchObject({ name: 'Prvi Igrač', starter: true, seconds: 899, points: 12, reb: 5, steals: 2, fgm: 4, fga: 9, playerId: null })
    expect(d.home.score).toBe(80)
    expect(d.status).toBe('finished')
    expect(d.playByPlay[0]).toEqual({ type: 3, minute: 40, score: '80:67', text: 'kraj utakmice' })
  })
})
