import type { CollectionConfig } from 'payload'

import { isSuperAdmin, tenantIdsWithRole } from '../access/roles'

/** "Sajt": kss.rs, lige.kss.rs, kasnije klubovi. */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: { singular: 'Sajt', plural: 'Sajtovi' },
  admin: { group: 'Sistem', useAsTitle: 'name', defaultColumns: ['name', 'type', 'domain'] },
  access: {
    // Frontend mora da pronađe sajt po hostu/putanji pre bilo kakve prijave; polja ispod nisu tajna.
    read: () => true,
    create: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isSuperAdmin(user)) return true
      const ids = tenantIdsWithRole(user, ['admin', 'club-admin'])
      return ids.length ? { id: { in: ids } } : false
    },
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Naziv' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Slug',
      admin: { description: 'npr. kss, lige, kk-partizan' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'federation',
      label: 'Tip',
      options: [
        { label: 'Savez (kss.rs, lige.kss.rs)', value: 'federation' },
        { label: 'Klub', value: 'club' },
      ],
    },
    {
      name: 'domain',
      type: 'text',
      unique: true,
      index: true,
      label: 'Domen',
      admin: { description: 'npr. kss.rs ili lige.kss.rs. Prazno za sajtove koji se adresiraju putanjom.' },
    },
    {
      name: 'pathPrefix',
      type: 'text',
      unique: true,
      index: true,
      label: 'Prefiks putanje',
      admin: { description: 'npr. klubovi/kk-partizan. Koristi se kada sajt nema svoj domen.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'primaryColor', type: 'text', label: 'Glavna boja', defaultValue: '#C8102E' },
        { name: 'secondaryColor', type: 'text', label: 'Druga boja' },
      ],
    },
    {
      name: 'adminColor',
      type: 'text',
      label: 'Boja u adminu',
      admin: { description: 'Oznaka sajta u meniju i gornjoj traci (hex, npr. #3b82f6). Ako je prazno, bira se automatski.' },
      validate: (v: unknown) => !v || /^#[0-9a-f]{6}$/i.test(String(v)) || 'Unesi boju u obliku #rrggbb',
    },
    { name: 'logo', type: 'upload', relationTo: 'media', label: 'Logo' },
    {
      name: 'defaultLocale',
      type: 'select',
      defaultValue: 'sr-cyrl',
      label: 'Podrazumevano pismo',
      options: [
        { label: 'Ćirilica', value: 'sr-cyrl' },
        { label: 'Latinica', value: 'sr-latn' },
      ],
    },
    {
      name: 'navigation',
      type: 'group',
      label: 'Navigacija',
      fields: [
        {
          name: 'main',
          type: 'array',
          label: 'Glavni meni',
          fields: [
            { name: 'label', type: 'text', required: true, label: 'Naziv' },
            { name: 'href', type: 'text', label: 'Link' },
            {
              name: 'children',
              type: 'array',
              label: 'Podmeni',
              fields: [
                { name: 'label', type: 'text', required: true, label: 'Naziv' },
                { name: 'href', type: 'text', required: true, label: 'Link' },
              ],
            },
          ],
        },
        {
          name: 'socials',
          type: 'array',
          label: 'Društvene mreže',
          fields: [
            { name: 'platform', type: 'text', required: true },
            { name: 'url', type: 'text', required: true },
          ],
        },
      ],
    },
  ],
}
