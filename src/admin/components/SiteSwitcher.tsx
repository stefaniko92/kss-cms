'use client'
import { toast } from '@payloadcms/ui'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'
import React from 'react'

import type { AdminTenant } from '../tenants'

/**
 * Izbor aktivnog sajta. Koristi isti izbor kao plugin (kolačić `payload-tenant`), pa filtrira liste, a dashboard
 * i oznaka u gornjoj traci se odmah menjaju. Podrazumevano (bez izbora) prikazuju se svi sajtovi korisnika.
 */
export const SiteSwitcher = ({ tenants }: { tenants: AdminTenant[] }) => {
  const { options, selectedTenantID, setTenant } = useTenantSelection()
  const mine = tenants.filter((t) => options.some((o) => String(o.value) === String(t.id)))
  if (mine.length === 0) return null

  const choose = (id: number | undefined, label: string) => {
    if (String(id) === String(selectedTenantID)) return
    setTenant({ id, refresh: true })
    toast.success(id === undefined ? 'Prikazani su svi sajtovi' : `Aktivni sajt: ${label}`)
  }

  return (
    <div className="kss-sites" role="group" aria-label="Aktivni sajt">
      <span className="kss-sites__label">Aktivni sajt</span>
      {mine.length > 1 && (
        <button type="button" className={`kss-sites__item ${selectedTenantID === undefined ? 'is-active' : ''}`} style={{ ['--site' as string]: '#94a3b8' }} onClick={() => choose(undefined, 'Svi sajtovi')}>
          <span className="kss-sites__dot kss-sites__dot--all" />
          <span className="kss-sites__text">
            <strong>Svi sajtovi</strong>
            <small>{mine.length} sajta</small>
          </span>
        </button>
      )}
      {mine.map((t) => (
        <button key={t.id} type="button" className={`kss-sites__item ${String(selectedTenantID) === String(t.id) ? 'is-active' : ''}`} onClick={() => choose(t.id, t.name)} style={{ ['--site' as string]: t.color }}>
          <span className="kss-sites__dot" />
          <span className="kss-sites__text">
            <strong>{t.name}</strong>
            <small>{t.domain ?? '—'}</small>
          </span>
        </button>
      ))}
    </div>
  )
}
