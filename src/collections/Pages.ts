import type { Block, CollectionConfig } from 'payload'

import { enforceTenantRole, publishedOrAuthed } from '../access/roles'
import { legacyFields } from '../fields/legacy'
import { slugField } from '../fields/slug'

const blocks: Block[] = [
  {
    slug: 'richText',
    labels: { singular: 'Tekst', plural: 'Tekstovi' },
    fields: [{ name: 'content', type: 'richText', required: true, label: 'Tekst' }],
  },
  {
    slug: 'image',
    labels: { singular: 'Slika', plural: 'Slike' },
    fields: [
      { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Slika' },
      { name: 'caption', type: 'text', label: 'Opis' },
    ],
  },
  {
    slug: 'documentList',
    labels: { singular: 'Lista dokumenata', plural: 'Liste dokumenata' },
    fields: [
      { name: 'title', type: 'text', label: 'Naslov' },
      {
        name: 'type',
        type: 'select',
        label: 'Tip dokumenata',
        options: [
          { label: 'Normativna akta', value: 'normative' },
          { label: 'Javne nabavke', value: 'public-procurement' },
          { label: 'Antidoping', value: 'anti-doping' },
          { label: 'Ostalo', value: 'other' },
        ],
      },
      { name: 'year', type: 'number', label: 'Godina (opciono)' },
    ],
  },
  {
    slug: 'faq',
    labels: { singular: 'Pitanja i odgovori', plural: 'Pitanja i odgovori' },
    fields: [
      {
        name: 'items',
        type: 'array',
        label: 'Stavke',
        fields: [
          { name: 'question', type: 'text', required: true, label: 'Pitanje' },
          { name: 'answer', type: 'richText', required: true, label: 'Odgovor' },
        ],
      },
    ],
  },
]

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Stranica', plural: 'Stranice' },
  admin: { group: 'Sadržaj', useAsTitle: 'title', defaultColumns: ['title', 'slug', 'parent', '_status'] },
  access: { read: publishedOrAuthed },
  hooks: { beforeValidate: [enforceTenantRole('site')] },
  versions: { drafts: true, maxPerDoc: 20 },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Naslov' },
    slugField('title'),
    { name: 'parent', type: 'relationship', relationTo: 'pages', label: 'Nadređena stranica', admin: { position: 'sidebar' } },
    { name: 'blocks', type: 'blocks', blocks, label: 'Sadržaj' },
    {
      name: 'english',
      type: 'group',
      label: 'English (opciono)',
      admin: { description: 'Engleska verzija stranice, ako postoji.' },
      fields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'body', type: 'richText', label: 'Content' },
      ],
    },
    ...legacyFields(),
  ],
}
