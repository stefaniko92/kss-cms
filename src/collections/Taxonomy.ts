import type { CollectionConfig } from 'payload'

import { enforceTenantRole } from '../access/roles'
import { legacyFields } from '../fields/legacy'
import { slugField } from '../fields/slug'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Kategorija', plural: 'Kategorije' },
  admin: { group: 'Sadržaj', useAsTitle: 'name' },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('content')] },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Naziv' },
    slugField('name'),
    { name: 'parent', type: 'relationship', relationTo: 'categories', label: 'Nadređena kategorija' },
    ...legacyFields(),
  ],
}

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Oznaka', plural: 'Oznake' },
  admin: { group: 'Sadržaj', useAsTitle: 'name' },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('content')] },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Naziv' },
    slugField('name'),
    ...legacyFields(),
  ],
}

export const Galleries: CollectionConfig = {
  slug: 'galleries',
  labels: { singular: 'Galerija', plural: 'Galerije' },
  admin: { group: 'Sadržaj', useAsTitle: 'title' },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('content')] },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Naslov' },
    {
      name: 'images',
      type: 'array',
      label: 'Slike',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Slika' },
        { name: 'caption', type: 'text', label: 'Opis' },
      ],
    },
    ...legacyFields(),
  ],
}
