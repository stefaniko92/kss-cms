import type { AdminViewServerProps } from 'payload'
import Link from 'next/link'
import React from 'react'

import { isBlocked } from '../../sports/dscore/client'
import { loadDashboard, type MatchRow } from '../dashboard-data'
import { BarChart, Donut } from './charts'

const ACTIONS = [
  { label: 'Nova vest', collection: 'articles' },
  { label: 'Novi dokument', collection: 'documents' },
  { label: 'Nova stranica', collection: 'pages' },
  { label: 'Nova selekcija', collection: 'team-seasons' },
]

const ICON: Record<string, string> = {
  article: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  check: 'M20 6 9 17l-5-5',
  doc: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 12h6M9 16h4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  ball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 4.5 6.5 4.5 10S15 19 12 22M12 2C9 5 7.5 8.5 7.5 12S9 19 12 22',
  plus: 'M12 5v14M5 12h14',
}
const Icon = ({ name }: { name: keyof typeof ICON }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICON[name]} />
  </svg>
)

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('sr-Latn-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')
const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'upravo sada'
  if (min < 60) return `pre ${min} min`
  if (min < 24 * 60) return `pre ${Math.round(min / 60)} č`
  if (min < 7 * 24 * 60) return `pre ${Math.round(min / 1440)} d`
  return fmtDate(iso)
}
const greeting = () => {
  const h = Number(new Date().toLocaleString('sr-Latn-RS', { hour: 'numeric', hour12: false, timeZone: 'Europe/Belgrade' }))
  return h < 11 ? 'Dobro jutro' : h < 18 ? 'Dobar dan' : 'Dobro veče'
}

function MatchLine({ m }: { m: MatchRow }) {
  const finished = m.status !== 'scheduled'
  return (
    <li className="kss-match">
      <span className="kss-match__league">{m.leagueName}</span>
      <span className="kss-match__teams">
        <span>{m.home.name}</span>
        <b className={finished ? 'kss-match__score' : 'kss-match__time'}>{finished ? `${m.home.score ?? 0} : ${m.away.score ?? 0}` : new Date(m.startsAt).toLocaleString('sr-Latn-RS', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Belgrade' })}</b>
        <span>{m.away.name}</span>
      </span>
    </li>
  )
}

export async function Dashboard({ initPageResult }: AdminViewServerProps) {
  const { req, permissions } = initPageResult
  const { payload, user } = req
  const admin = payload.config.routes.admin
  const u = user as unknown as { name?: string; email: string; roles?: string[] }
  const isSuper = Boolean(u.roles?.includes('super-admin'))
  const can = (collection: string, action: 'create' | 'read') => Boolean((permissions.collections as Record<string, Record<string, unknown>> | undefined)?.[collection]?.[action])

  const d = await loadDashboard(req, can, admin)
  const name = u.name?.split(' ')[0] || u.email
  const today = new Date().toLocaleDateString('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const actions = ACTIONS.filter((a) => can(a.collection, 'create')).slice(0, 3)
  const scopeLabel = d.scope ? d.scope.name : d.tenants.length > 1 ? 'Svi sajtovi' : (d.tenants[0]?.name ?? '')
  const mixTotalLabel = 'stavki sadržaja'

  return (
    <div className="kss-dash gutter--left gutter--right">
      {/* ---------------------------------------------------------------- banner */}
      <section className="kss-hero" style={{ ['--site' as string]: d.scope?.color ?? '#cbd5e1' }}>
        <div className="kss-hero__text">
          <span className="kss-hero__scope">
            <i /> {scopeLabel}
            {d.scope?.domain ? <em>{d.scope.domain}</em> : null}
          </span>
          <h1>
            {greeting()}, {name}
          </h1>
          <p>
            {today} · {d.kpis.published > 0 ? `Ovog meseca objavljeno je ${d.kpis.published.toLocaleString('sr-Latn-RS')} ${d.kpis.published === 1 ? 'članak' : 'članaka'}` : 'Ovog meseca još nema objavljenih članaka'}
            {d.kpis.drafts > 0 ? `, a ${d.kpis.drafts.toLocaleString('sr-Latn-RS')} čeka objavu.` : '.'}
          </p>
          {actions.length > 0 && (
            <div className="kss-hero__actions">
              {actions.map((a) => (
                <Link key={a.collection} href={`${admin}/collections/${a.collection}/create`} className="kss-hero__btn">
                  <Icon name="plus" /> {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <svg className="kss-hero__art" viewBox="0 0 240 200" aria-hidden>
          <circle cx="150" cy="100" r="86" className="a" />
          <circle cx="150" cy="100" r="62" className="b" />
          <path d="M64 100h172M150 14c28 26 28 146 0 172M150 14c-28 26-28 146 0 172" className="c" />
        </svg>
      </section>

      {/* ---------------------------------------------------------------- KPI */}
      <section className="kss-kpis">
        <div className="kss-kpi">
          <span className="kss-kpi__icon"><Icon name="article" /></span>
          <div>
            <small>Objavljeno ovog meseca</small>
            <b>{d.kpis.published.toLocaleString('sr-Latn-RS')}</b>
            <em>prošli mesec: {d.kpis.prevPublished.toLocaleString('sr-Latn-RS')}</em>
          </div>
        </div>
        <Link className="kss-kpi" href={`${admin}/collections/articles?where[and][0][_status][equals]=draft${d.scope ? `&where[and][1][tenant][equals]=${d.scope.id}` : ''}`}>
          <span className="kss-kpi__icon kss-kpi__icon--amber"><Icon name="edit" /></span>
          <div>
            <small>Nacrti</small>
            <b>{d.kpis.drafts.toLocaleString('sr-Latn-RS')}</b>
            <em>čekaju objavu</em>
          </div>
        </Link>
        <div className="kss-kpi">
          <span className="kss-kpi__icon kss-kpi__icon--green"><Icon name="check" /></span>
          <div>
            <small>Ukupno članaka</small>
            <b>{d.kpis.articles.toLocaleString('sr-Latn-RS')}</b>
            <em>u arhivi</em>
          </div>
        </div>
        <div className="kss-kpi">
          <span className="kss-kpi__icon kss-kpi__icon--violet"><Icon name="doc" /></span>
          <div>
            <small>Dokumenta</small>
            <b>{d.kpis.documents.toLocaleString('sr-Latn-RS')}</b>
            <em>odluke i saopštenja</em>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- grafikoni */}
      <section className="kss-grid">
        <div className="kss-card kss-card--wide">
          <header>
            <h2>Objave po mesecima</h2>
            <span className="kss-legend"><i className="news" /> Vesti <i className="reports" /> Izveštaji</span>
          </header>
          <BarChart data={d.months} />
        </div>
        <div className="kss-card">
          <header>
            <h2>Struktura sadržaja</h2>
          </header>
          {d.mix.length ? <Donut segments={d.mix} centerLabel={mixTotalLabel} /> : <p className="kss-muted">Još nema sadržaja.</p>}
        </div>
      </section>

      {/* ---------------------------------------------------------------- aktivnost + sidebar */}
      <section className="kss-grid kss-grid--b">
        <div className="kss-card kss-card--wide">
          <header>
            <h2>Poslednje izmene</h2>
          </header>
          <ul className="kss-feed">
            {d.activity.length === 0 && <li className="kss-muted">Nema skorašnjih izmena.</li>}
            {d.activity.map((a) => (
              <li key={`${a.collection}-${a.id}`}>
                <span className="kss-feed__dot" style={{ background: a.tenant?.color ?? '#98a2b3' }} title={a.tenant?.name} />
                <div>
                  <Link href={`${admin}/collections/${a.collection}/${a.id}`}>{a.title}</Link>
                  <small>
                    {a.type} · {a.tenant?.domain ?? a.tenant?.name ?? ''} · {ago(a.updatedAt)}
                  </small>
                </div>
                {a.draft && <span className="kss-badge">nacrt</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="kss-stack">
          {d.todo.length > 0 && (
            <div className="kss-card">
              <header>
                <h2>Za doradu</h2>
              </header>
              <ul className="kss-todo">
                {d.todo.map((t) => (
                  <li key={t.label}>
                    <Link href={t.href}>
                      <span className="kss-todo__icon"><Icon name="alert" /></span>
                      <span className="kss-todo__text">
                        <strong>{t.label}</strong>
                        <small>{t.hint}</small>
                      </span>
                      <b>{t.count.toLocaleString('sr-Latn-RS')}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.matches && (
            <div className="kss-card">
              <header>
                <h2>Rezultati i raspored</h2>
                {d.matches.live.length > 0 && <span className="kss-live">UŽIVO</span>}
              </header>
              {d.matches.live.length + d.matches.last.length + d.matches.next.length === 0 ? (
                <p className="kss-muted">Nema utakmica u kešu. Pokreni sinhronizaciju sa DScore-om.</p>
              ) : (
                <>
                  {d.matches.live.length > 0 && (
                    <>
                      <h3>Uživo</h3>
                      <ul className="kss-matches">{d.matches.live.map((m) => <MatchLine key={m.id} m={m} />)}</ul>
                    </>
                  )}
                  {d.matches.last.length > 0 && (
                    <>
                      <h3>Poslednji rezultati</h3>
                      <ul className="kss-matches">{d.matches.last.map((m) => <MatchLine key={m.id} m={m} />)}</ul>
                    </>
                  )}
                  {d.matches.next.length > 0 && (
                    <>
                      <h3>Sledeće utakmice</h3>
                      <ul className="kss-matches">{d.matches.next.map((m) => <MatchLine key={m.id} m={m} />)}</ul>
                    </>
                  )}
                </>
              )}
              {isSuper && (
                <footer className="kss-card__foot">
                  <span className={`kss-dot ${isBlocked() ? 'is-bad' : 'is-ok'}`} />
                  DScore: {isBlocked() ? 'blokiran (provera posetioca), služi se keš' : 'dostupan'} · keš {d.matches.cachedAt ? ago(d.matches.cachedAt) : 'prazan'}
                </footer>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
