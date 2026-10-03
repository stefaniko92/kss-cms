import React from 'react'

/** Stubičasti grafikon (vesti + izveštaji po mesecima). Čist SVG, renderuje se na serveru. */
export function BarChart({ data }: { data: { label: string; news: number; reports: number }[] }) {
  const W = 640
  const H = 220
  const pad = { l: 34, r: 8, t: 12, b: 26 }
  const max = Math.max(4, ...data.map((d) => d.news + d.reports))
  // "lepa" skala: 4 podeoka sa korakom iz niza (1, 2, 5, 10, 20, 25, 50…)
  const tickStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((x) => x * 4 >= max) ?? Math.ceil(max / 4)
  const nice = tickStep * 4
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const step = innerW / data.length
  const bw = Math.min(28, step * 0.58)
  const y = (v: number) => pad.t + innerH - (v / nice) * innerH
  const ticks = [0, 1, 2, 3, 4].map((i) => i * tickStep)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="kss-chart" role="img" aria-label="Objave po mesecima">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="kss-chart__grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="kss-chart__tick">{t}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = pad.l + i * step + (step - bw) / 2
        const hNews = (d.news / nice) * innerH
        const hRep = (d.reports / nice) * innerH
        return (
          <g key={i}>
            <title>{`${d.label}: ${d.news} vesti, ${d.reports} izveštaja`}</title>
            {d.reports > 0 && <rect x={x} y={y(d.news + d.reports)} width={bw} height={hRep} rx={3} className="kss-chart__bar kss-chart__bar--reports" />}
            {d.news > 0 && <rect x={x} y={y(d.news)} width={bw} height={hNews} rx={3} className="kss-chart__bar kss-chart__bar--news" />}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="kss-chart__tick">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Prsten sa raspodelom sadržaja. */
export function Donut({ segments, centerLabel }: { segments: { label: string; value: number; color: string }[]; centerLabel: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const R = 54
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="kss-donut">
      <svg viewBox="0 0 140 140" className="kss-donut__svg" role="img" aria-label="Struktura sadržaja">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef0f4" strokeWidth="16" />
        {segments.map((s) => {
          const len = (s.value / total) * C
          const el = (
            <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)">
              <title>{`${s.label}: ${s.value.toLocaleString('sr-Latn-RS')}`}</title>
            </circle>
          )
          offset += len
          return el
        })}
        <text x="70" y="66" textAnchor="middle" className="kss-donut__num">{total.toLocaleString('sr-Latn-RS')}</text>
        <text x="70" y="84" textAnchor="middle" className="kss-donut__cap">{centerLabel}</text>
      </svg>
      <ul className="kss-donut__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span style={{ background: s.color }} />
            {s.label}
            <b>{s.value.toLocaleString('sr-Latn-RS')}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
