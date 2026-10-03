import { APIError } from 'payload'
import type { CollectionBeforeValidateHook, Where } from 'payload'

/**
 * Role su dvoslojne:
 *  - globalna: `user.roles` ('super-admin' vidi i menja sve)
 *  - po tenant-u: `user.tenants[].roles` (šta korisnik sme na tom sajtu)
 */
export const TENANT_ROLES = [
  { label: 'Administrator sajta', value: 'admin' },
  { label: 'Urednik vesti', value: 'news-editor' },
  { label: 'Urednik reprezentacija', value: 'teams-editor' },
  { label: 'Urednik takmičenja', value: 'competitions-editor' },
  { label: 'Urednik dokumenata / odluka', value: 'documents-editor' },
  { label: 'Klub – administrator', value: 'club-admin' },
  { label: 'Klub – urednik', value: 'club-editor' },
] as const

export type TenantRole = (typeof TENANT_ROLES)[number]['value']

/** Grupe sadržaja i uloge kojima je dozvoljeno pisanje. Čitanje imaju svi članovi tenant-a. */
export const WRITE_ROLES = {
  content: ['admin', 'news-editor', 'competitions-editor', 'club-admin', 'club-editor'],
  teams: ['admin', 'teams-editor'],
  competitions: ['admin', 'competitions-editor'],
  documents: ['admin', 'documents-editor', 'competitions-editor'],
  site: ['admin', 'club-admin'],
  adminOnly: ['admin'],
} as const satisfies Record<string, readonly TenantRole[]>

export type AccessGroup = keyof typeof WRITE_ROLES

type UserLike = {
  roles?: string[] | null
  tenants?: { tenant: number | string | { id: number | string }; roles?: string[] | null }[] | null
} | null | undefined

const idOf = (t: number | string | { id: number | string }) => (typeof t === 'object' ? t.id : t)

export const isSuperAdmin = (user: UserLike): boolean => Boolean(user?.roles?.includes('super-admin'))

/** ID-jevi tenant-a u kojima korisnik ima bar jednu od datih uloga. */
export const tenantIdsWithRole = (user: UserLike, roles: readonly string[]): (number | string)[] =>
  (user?.tenants ?? [])
    .filter((row) => (row.roles ?? []).some((r) => roles.includes(r)))
    .map((row) => idOf(row.tenant))

/**
 * `accessResultOverride` za multi-tenant plugin: plugin već ograničava rezultat na tenant-e
 * korisnika; mi dodatno suzimo pisanje na tenant-e u kojima korisnik ima odgovarajuću ulogu.
 */
export const groupAccess =
  (group: AccessGroup) =>
  ({ accessKey, accessResult, req }: { accessKey: string; accessResult: unknown; req: { user?: unknown } }) => {
    const user = req.user as UserLike
    // Čitanje: javno čitanje kolekcija rešava sama kolekcija; plugin sužava za prijavljene.
    if (accessKey === 'read' || accessKey === 'readVersions') {
      if (accessKey === 'readVersions' && !user) return false
      return accessResult as boolean | Where
    }
    if (!user) return false
    if (isSuperAdmin(user)) return accessResult as boolean | Where
    const ids = tenantIdsWithRole(user, WRITE_ROLES[group])
    if (ids.length === 0) return false
    if (accessKey === 'create') return true // tenant proverava hook ispod
    if (accessResult === false) return false
    const and: Where[] = [{ tenant: { in: ids } }]
    if (accessResult && typeof accessResult === 'object') and.push(accessResult as Where)
    return { and } as Where
  }

/** Sprečava upis u tenant u kojem korisnik nema odgovarajuću ulogu. */
export const enforceTenantRole = (group: AccessGroup): CollectionBeforeValidateHook =>
  ({ data, originalDoc, req }) => {
    const user = req.user as UserLike
    if (!user || isSuperAdmin(user)) return data
    const raw = data?.tenant ?? originalDoc?.tenant
    if (raw === undefined || raw === null) return data
    const tenantId = idOf(raw as number | string | { id: number | string })
    const allowed = tenantIdsWithRole(user, WRITE_ROLES[group])
    if (!allowed.some((id) => String(id) === String(tenantId))) {
      throw new APIError('Nemate dozvolu za izmene na ovom sajtu.', 403)
    }
    return data
  }

/** Javno vidljivi samo objavljeni dokumenti; prijavljeni vide sve (u okviru tenant filtera). */
export const publishedOrAuthed = ({ req }: { req: { user?: unknown } }): boolean | Where =>
  req.user ? true : { _status: { equals: 'published' } }

/** Za meni admina: sakrij kolekciju ako korisnik nema pravo pisanja ni na jednom sajtu (super-admin vidi sve). */
export const hiddenUnlessCanWrite =
  (group: AccessGroup) =>
  ({ user }: { user?: unknown }): boolean => {
    const u = user as UserLike
    return !(isSuperAdmin(u) || tenantIdsWithRole(u, WRITE_ROLES[group]).length > 0)
  }

export const hiddenUnlessSuperAdmin = ({ user }: { user?: unknown }): boolean => !isSuperAdmin(user as UserLike)
