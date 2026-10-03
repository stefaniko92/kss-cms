import type { CollectionConfig } from 'payload'

import { isSuperAdmin } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Korisnik', plural: 'Korisnici' },
  admin: { group: 'Sistem',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'roles'],
  },
  auth: true,
  access: {
    // Admin panel je samo za one koji imaju bar jedan tenant ili su super-admin
    admin: ({ req: { user } }) =>
      Boolean(user && (isSuperAdmin(user) || (user.tenants?.length ?? 0) > 0)),
    create: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user }, id }) => (isSuperAdmin(user) ? true : Boolean(user && user.id === id)),
  },
  fields: [
    { name: 'name', type: 'text', label: 'Ime i prezime' },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      saveToJWT: true,
      defaultValue: [],
      label: 'Globalne uloge',
      options: [{ label: 'Super administrator', value: 'super-admin' }],
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
      },
    },
    // `tenants` polje (sa ulogama po sajtu) dodaje multi-tenant plugin, vidi payload.config.ts
  ],
}
