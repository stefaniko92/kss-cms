import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'
import type { PayloadRequest, Where } from 'payload'

import type { Match } from '../sports/types'
import { getAdminTenants, type AdminTenant } from './tenants'

type Perm = (collection: string, action: 'create' | 'read') => boolean

export type ActivityItem = {
  id: number
  type: 'Članak' | 'Dokument' | 'Stranica'
  collection: 'articles' | 'documents' | 'pages'
  title: string
  tenant?: AdminTenant
  updatedAt: string
  draft: boolean
}

export type TodoItem = { label: string; hint: string; count: number; href: string }

export type DashboardData = {
  tenants: AdminTenant[]
  scope: AdminTenant | null
  kpis: { published: number; prevPublished: number; drafts: number; articles: number; documents: number }
  months: { key: string; label: string; news: number; reports: number }[]
  mix: { label: string; value: number; color: string }[]
  activity: ActivityItem[]
  todo: TodoItem[]
  matches: { live: MatchRow[]; last: MatchRow[]; next: MatchRow[]; cachedAt: string | null } | null
}

export type MatchRow = Match & { leagueName: string }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']

export async function loadDashboard(req: PayloadRequest, can: Perm, adminPath: string): Promise<DashboardData> {
  const { payload, user } = req
  const u = user as unknown as { roles?: string[]; tenants?: { tenant: number | { id: number } }[] }
  const isSuper = Boolean(u.roles?.includes('super-admin'))
  const mine = new Set((u.tenants ?? []).map((t) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant)))
  const allTenants = (await getAdminTenants(payload)).filter((t) => isSuper || mine.has(t.id))

  const selectedId = getTenantFromCookie(req.headers, payload.db.defaultIDType)
  const scope = allTenants.find((t) => String(t.id) === String(selectedId)) ?? null
  const tenantById = new Map(allTenants.map((t) => [t.id, t]))

  const scoped = (...extra: Where[]): Where => ({ and: [...(scope ? [{ tenant: { equals: scope.id } }] : []), ...extra] })

  const count = async (collection: string, where: Where) => {
    if (!can(collection, 'read')) return 0
    try {
      return (await payload.count({ collection: collection as 'articles', where, user, overrideAccess: false })).totalDocs
    } catch {
      return 0
    }
  }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const chartStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
  const published = { _status: { equals: 'published' } } as Where
  const draft = { _status: { equals: 'draft' } } as Where

  const [pubNow, pubPrev, draftA, draftD, draftP, articles, documents, news, reports, pages, teamSeasons] = await Promise.all([
    count('articles', scoped(published, { publishedAt: { greater_than_equal: monthStart.toISOString() } })),
    count('articles', scoped(published, { publishedAt: { greater_than_equal: prevStart.toISOString() } }, { publishedAt: { less_than: monthStart.toISOString() } })),
    count('articles', scoped(draft)),
    count('documents', scoped(draft)),
    count('pages', scoped(draft)),
    count('articles', scoped()),
    count('documents', scoped()),
    count('articles', scoped({ kind: { equals: 'news' } })),
    count('articles', scoped({ kind: { equals: 'match-report' } })),
    count('pages', scoped()),
    count('team-seasons', scoped()),
  ])

  // objave po mesecima (poslednjih 12): jedan upit, grupisanje u memoriji
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth() + i, 1))
    return { key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MONTHS[d.getUTCMonth()], news: 0, reports: 0 }
  })
  if (can('articles', 'read')) {
    const rows = await payload.find({
      collection: 'articles',
      where: scoped(published, { publishedAt: { greater_than_equal: chartStart.toISOString() } }),
      select: { publishedAt: true, kind: true },
      limit: 20000,
      pagination: false,
      depth: 0,
      user,
      overrideAccess: false,
    })
    for (const r of rows.docs) {
      if (!r.publishedAt) continue
      const d = new Date(r.publishedAt)
      const m = months.find((x) => x.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`)
      if (m) r.kind === 'match-report' ? m.reports++ : m.news++
    }
  }

  // poslednje izmene: članci + dokumenta + stranice
  const feed = async (collection: ActivityItem['collection'], type: ActivityItem['type']): Promise<ActivityItem[]> => {
    if (!can(collection, 'read')) return []
    const res = await payload.find({
      collection,
      where: scoped(),
      sort: '-updatedAt',
      limit: 6,
      depth: 0,
      draft: true,
      user,
      overrideAccess: false,
    })
    return res.docs.map((d) => ({
      id: d.id,
      type,
      collection,
      title: (d as { title?: string }).title ?? '(bez naslova)',
      tenant: tenantById.get((d as { tenant?: number }).tenant as number),
      updatedAt: d.updatedAt,
      draft: (d as { _status?: string })._status === 'draft',
    }))
  }
  const activity = (await Promise.all([feed('articles', 'Članak'), feed('documents', 'Dokument'), feed('pages', 'Stranica')]))
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)

  // za doradu
  const tenantQs = scope ? `&where[and][1][tenant][equals]=${scope.id}` : ''
  const link = (collection: string, field: string, op: string, value: string) => `${adminPath}/collections/${collection}?where[and][0][${field}][${op}]=${value}${tenantQs}`
  const [noHero, noPhoto, noFile] = await Promise.all([
    count('articles', scoped({ heroImage: { exists: false } })),
    count('people', scoped({ photo: { exists: false } })),
    count('documents', scoped({ file: { exists: false } })),
  ])
  const todo: TodoItem[] = [
    { label: 'Nacrti koji čekaju objavu', hint: 'Članci, dokumenta i stranice', count: draftA + draftD + draftP, href: link('articles', '_status', 'equals', 'draft') },
    { label: 'Članci bez naslovne slike', hint: 'Slike iz starog sajta još nisu uvezene', count: noHero, href: link('articles', 'heroImage', 'exists', 'false') },
    { label: 'Dokumenta bez priloženog fajla', hint: 'Nema PDF-a uz odluku', count: noFile, href: link('documents', 'file', 'exists', 'false') },
    { label: 'Osobe bez fotografije', hint: 'Igrači i treneri reprezentacija', count: noPhoto, href: link('people', 'photo', 'exists', 'false') },
  ].filter((t) => t.count > 0)

  // utakmice iz keša (bez novih poziva ka DScore-u)
  let matches: DashboardData['matches'] = null
  if (can('competitions', 'read')) {
    const cache = await payload.find({ collection: 'sports-cache', where: { kind: { equals: 'schedule' } }, limit: 80, depth: 0, overrideAccess: true })
    const all: MatchRow[] = []
    let cachedAt: string | null = null
    for (const doc of cache.docs) {
      const d = doc.data as { league?: { name?: string }; matches?: Match[] }
      for (const m of d.matches ?? []) all.push({ ...m, leagueName: d.league?.name ?? '' })
      if (!cachedAt || doc.fetchedAt > cachedAt) cachedAt = doc.fetchedAt
    }
    const t = now.getTime()
    const day = 86_400_000
    const live = all.filter((m) => m.status === 'live')
    const last = all.filter((m) => m.status === 'finished' && t - new Date(m.startsAt).getTime() < 21 * day).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 5)
    const next = all.filter((m) => m.status === 'scheduled' && new Date(m.startsAt).getTime() >= t - 3 * 3600_000 && new Date(m.startsAt).getTime() - t < 21 * day).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5)
    matches = { live, last, next, cachedAt }
  }

  const mix = [
    { label: 'Vesti', value: news - 0, color: 'var(--kss-primary)' },
    { label: 'Izveštaji', value: reports, color: 'var(--kss-accent)' },
    { label: 'Dokumenta', value: documents, color: '#f59e0b' },
    { label: 'Stranice', value: pages, color: '#10b981' },
    { label: 'Selekcije', value: teamSeasons, color: '#8b5cf6' },
  ].filter((m) => m.value > 0)

  return {
    tenants: allTenants,
    scope,
    kpis: { published: pubNow, prevPublished: pubPrev, drafts: draftA + draftD + draftP, articles, documents },
    months,
    mix,
    activity,
    todo,
    matches,
  }
}
