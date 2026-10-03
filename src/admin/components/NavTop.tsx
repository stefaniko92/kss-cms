import type { ServerProps } from 'payload'
import React from 'react'

import { getAdminTenants } from '../tenants'
import type { ThemeData } from '../theme'
import { SiteSwitcher } from './SiteSwitcher'

/** Vrh bočnog menija: logo/naziv aplikacije, ispod izbor aktivnog sajta. */
export async function NavTop({ payload }: ServerProps) {
  const [tenants, theme] = await Promise.all([
    getAdminTenants(payload),
    payload.findGlobal({ slug: 'admin-theme', depth: 0, overrideAccess: true }).catch(() => null),
  ])
  const appName = (theme as ThemeData | null)?.appName?.trim() || 'KSS CMS'
  return (
    <div className="kss-navtop">
      <a className="kss-navtop__brand" href={payload.config.routes.admin}>
        <img src="/brand/kss-logo.png" alt="KSS" height={40} />
        <span>
          <strong>{appName}</strong>
          <small>Košarkaški savez Srbije</small>
        </span>
      </a>
      <SiteSwitcher tenants={tenants} />
    </div>
  )
}
