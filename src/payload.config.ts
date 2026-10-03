import { postgresAdapter } from '@payloadcms/db-postgres'
import { EXPERIMENTAL_TableFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { rsLatin } from '@payloadcms/translations/languages/rsLatin'
import path from 'path'
import { buildConfig } from 'payload'
import type { CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { groupAccess, hiddenUnlessCanWrite, hiddenUnlessSuperAdmin, isSuperAdmin, TENANT_ROLES } from './access/roles'
import type { AccessGroup } from './access/roles'
import { Articles } from './collections/Articles'
import { CompetitionPhases, Competitions, Seasons } from './collections/Competitions'
import { Documents } from './collections/Documents'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { SportsCache } from './collections/SportsCache'
import { Banners, Redirects, Sponsors } from './collections/SiteExtras'
import { Categories, Galleries, Tags } from './collections/Taxonomy'
import { NationalTeams, OrganMembers, People, TeamSeasons } from './collections/Teams'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { AdminTheme } from './globals/AdminTheme'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/** Kolekcije vezane za sajt (tenant) i grupa dozvola koja ih štiti. */
const tenantCollections: Record<string, AccessGroup> = {
  articles: 'content',
  categories: 'content',
  tags: 'content',
  galleries: 'content',
  media: 'content',
  pages: 'site',
  sponsors: 'site',
  banners: 'site',
  redirects: 'adminOnly',
  documents: 'documents',
  'national-teams': 'teams',
  people: 'teams',
  'team-seasons': 'teams',
  'organ-members': 'teams',
  competitions: 'competitions',
  seasons: 'competitions',
  'competition-phases': 'competitions',
}

/** Meni admina: korisnik vidi samo kolekcije koje sme da menja (čitanje ostaje dostupno kroz relacije). */
function withMenuVisibility(collections: CollectionConfig[]): CollectionConfig[] {
  return collections.map((c) => {
    const hidden =
      c.slug === 'users' ? hiddenUnlessSuperAdmin : c.slug === 'tenants' ? hiddenUnlessCanWrite('adminOnly') : tenantCollections[c.slug] ? hiddenUnlessCanWrite(tenantCollections[c.slug]) : undefined
    return hidden && c.admin?.hidden === undefined ? { ...c, admin: { ...c.admin, hidden } } : c
  })
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    theme: 'light', // tema je brendirana samo u svetlom izgledu
    meta: { titleSuffix: ' – KSS CMS', icons: [{ rel: 'icon', url: '/brand/kss-logo.png' }] },
    components: {
      graphics: { Logo: '/admin/components/Logo#Logo', Icon: '/admin/components/Logo#Icon' },
      header: ['/admin/components/ThemeStyle#ThemeStyle'],
      beforeNavLinks: ['/admin/components/NavTop#NavTop'],
      actions: ['/admin/components/SiteChip#SiteChip'],
      beforeLogin: ['/admin/components/LoginBrand#LoginBrand'],
      views: { dashboard: { Component: '/admin/components/Dashboard#Dashboard' } },
    },
  },
  i18n: {
    supportedLanguages: { 'rs-latin': rsLatin },
    fallbackLanguage: 'rs-latin',
  },
  collections: withMenuVisibility([
    // redosled = redosled grupa u meniju: Sadržaj, Reprezentacije, Takmičenja, Sistem
    Articles,
    Categories,
    Tags,
    Galleries,
    Pages,
    Documents,
    Media,
    Banners,
    Sponsors,
    NationalTeams,
    People,
    TeamSeasons,
    OrganMembers,
    Competitions,
    Seasons,
    CompetitionPhases,
    Users,
    Tenants,
    Redirects,
    SportsCache,
  ]),

  globals: [AdminTheme],

  editor: lexicalEditor({
    // tabele su potrebne za stare stranice (rasporedi priprema) i neke vesti
    features: ({ defaultFeatures }) => [...defaultFeatures, EXPERIMENTAL_TableFeature()],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    multiTenantPlugin({
      tenantsSlug: Tenants.slug,
      i18n: {
        translations: {
          'rs-latin': {
            'nav-tenantSelector-label': 'Sajt',
            'assign-tenant-button-label': 'Dodeli sajt',
            'assign-tenant-modal-title': 'Dodeli sajt: „{{title}}"',
            'field-assignedTenant-label': 'Dodeljeni sajt',
          },
        },
      },
      // Pristup tenants kolekciji definišemo sami (javno čitanje za frontend)
      useTenantsCollectionAccess: false,
      userHasAccessToAllTenants: (user) => isSuperAdmin(user as { roles?: string[] }),
      collections: Object.fromEntries(
        Object.entries(tenantCollections).map(([slug, group]) => [
          slug,
          { accessResultOverride: groupAccess(group) },
        ]),
      ),
      tenantsArrayField: {
        includeDefaultField: true,
        arrayFieldAccess: {
          create: ({ req }) => isSuperAdmin(req.user),
          update: ({ req }) => isSuperAdmin(req.user),
        },
        rowFields: [
          {
            name: 'roles',
            type: 'select',
            hasMany: true,
            required: true,
            defaultValue: ['news-editor'],
            label: 'Uloge na sajtu',
            options: [...TENANT_ROLES],
          },
        ],
      },
    }),
  ],
})
