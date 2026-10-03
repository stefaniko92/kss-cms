import type { ServerProps } from 'payload'
import React from 'react'

import { getAdminTenants } from '../tenants'
import { SiteChipClient } from './SiteChipClient'

/** Oznaka aktivnog sajta u gornjoj traci (stalno vidljiva, menja se čim se promeni sajt). */
export async function SiteChip({ payload }: ServerProps) {
  return <SiteChipClient tenants={await getAdminTenants(payload)} />
}
