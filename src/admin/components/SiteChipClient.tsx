'use client'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'
import React from 'react'

import type { AdminTenant } from '../tenants'

export const SiteChipClient = ({ tenants }: { tenants: AdminTenant[] }) => {
  const { selectedTenantID, options } = useTenantSelection()
  const mine = tenants.filter((t) => options.some((o) => String(o.value) === String(t.id)))
  const active = mine.find((t) => String(t.id) === String(selectedTenantID))
  if (!mine.length) return null
  return (
    <span className="kss-chip" style={{ ['--site' as string]: active?.color ?? '#98a2b3' }} title="Aktivni sajt (menja se u bočnom meniju)">
      <span className="kss-chip__dot" />
      {active ? active.domain ?? active.name : mine.length > 1 ? 'Svi sajtovi' : mine[0].name}
    </span>
  )
}
