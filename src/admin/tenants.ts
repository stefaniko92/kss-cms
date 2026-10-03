import type { Payload } from 'payload'

export type AdminTenant = { id: number; name: string; domain: string | null; color: string }

const PALETTE = ['#e5394a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

/** Sajtovi za prikaz u adminu (naziv, domen, boja oznake). Dozvole se primenjuju u klijentu preko plugina. */
export async function getAdminTenants(payload: Payload): Promise<AdminTenant[]> {
  const res = await payload.find({ collection: 'tenants', depth: 0, limit: 100, sort: 'name', overrideAccess: true })
  return res.docs.map((t, i) => ({
    id: t.id,
    name: t.name,
    domain: t.domain ?? null,
    color: /^#[0-9a-f]{6}$/i.test(t.adminColor ?? '') ? (t.adminColor as string) : PALETTE[i % PALETTE.length],
  }))
}
