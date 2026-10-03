import type { CollectionConfig } from 'payload'

import { enforceTenantRole, publishedOrAuthed } from '../access/roles'
import { legacyFields } from '../fields/legacy'
import { slugField } from '../fields/slug'

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'Članak', plural: 'Članci' },
  admin: { group: 'Sadržaj',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'placement', 'publishedAt', '_status'],
    listSearchableFields: ['title', 'slug'],
  },
  access: { read: publishedOrAuthed },
  hooks: { beforeValidate: [enforceTenantRole('content')] },
  versions: { drafts: true, maxPerDoc: 20 },
  defaultSort: '-publishedAt',
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Naslov' },
    slugField('title'),
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'news',
      label: 'Vrsta',
      options: [
        { label: 'Vest', value: 'news' },
        { label: 'Izveštaj sa utakmice', value: 'match-report' },
        { label: 'Saopštenje', value: 'announcement' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'placement',
      type: 'select',
      defaultValue: 'none',
      label: 'Istaknuto',
      options: [
        { label: 'Obično', value: 'none' },
        { label: 'Istaknuta vest', value: 'featured' },
        { label: 'Slajder na početnoj', value: 'hero-slider' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'publishedAt', type: 'date', label: 'Datum objave', admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd.MM.yyyy. HH:mm' } } },
    { name: 'excerpt', type: 'textarea', label: 'Kratak opis' },
    { name: 'heroImage', type: 'upload', relationTo: 'media', label: 'Naslovna slika' },
    { name: 'body', type: 'richText', label: 'Tekst' },
    { name: 'gallery', type: 'relationship', relationTo: 'galleries', label: 'Galerija' },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true, label: 'Kategorije' },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, label: 'Oznake' },
    {
      type: 'collapsible',
      label: 'Povezano',
      fields: [
        { name: 'nationalTeam', type: 'relationship', relationTo: 'national-teams', label: 'Reprezentacija' },
        { name: 'competitionPhase', type: 'relationship', relationTo: 'competition-phases', label: 'Takmičenje / faza' },
        {
          name: 'dscoreGameId',
          type: 'number',
          index: true,
          label: 'DScore ID utakmice',
          admin: { description: 'Povezuje izveštaj sa utakmicom u DScore-u.' },
        },
      ],
    },
    ...legacyFields({ html: true }),
  ],
}
