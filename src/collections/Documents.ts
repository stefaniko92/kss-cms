import type { CollectionConfig } from 'payload'

import { enforceTenantRole, publishedOrAuthed } from '../access/roles'
import { legacyFields } from '../fields/legacy'

export const DOCUMENT_TYPES = [
  { label: 'Normativno akt', value: 'normative' },
  { label: 'Odluka o registraciji', value: 'registration-decision' },
  { label: 'Odluka UO KSS', value: 'ukss-decision' },
  { label: 'Odluka za takmičenje', value: 'competition-decision' },
  { label: 'Odluka Disciplinskog suda', value: 'disciplinary-decision' },
  { label: 'Profesionalni ugovor', value: 'pro-contract' },
  { label: 'Javna nabavka', value: 'public-procurement' },
  { label: 'Dozvola za sezonu', value: 'permit' },
  { label: 'Antidoping', value: 'anti-doping' },
  { label: 'Plan i program rada', value: 'plan' },
  { label: 'Ostalo', value: 'other' },
]

/** Odluke imaju pravni značaj: verzionisanje, a "brisanje" je arhiviranje. */
export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Dokument', plural: 'Dokumenta' },
  admin: { group: 'Sadržaj',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'number', 'date', 'archived'],
    listSearchableFields: ['title', 'number'],
  },
  access: { read: publishedOrAuthed },
  hooks: { beforeValidate: [enforceTenantRole('documents')] },
  versions: { drafts: true, maxPerDoc: 50 },
  defaultSort: '-date',
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Naslov' },
    { name: 'type', type: 'select', required: true, options: DOCUMENT_TYPES, label: 'Vrsta', admin: { position: 'sidebar' } },
    {
      name: 'commission',
      type: 'select',
      label: 'Komisija',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Komisija za takmičenje', value: 'competition' },
        { label: 'Komisija za registraciju', value: 'registration' },
        { label: 'Sudijska komisija', value: 'referees' },
        { label: 'Disciplinski sud', value: 'disciplinary' },
        { label: 'Upravni odbor', value: 'ukss' },
      ],
    },
    { name: 'number', type: 'text', label: 'Broj akta' },
    { name: 'date', type: 'date', label: 'Datum', admin: { position: 'sidebar', date: { displayFormat: 'dd.MM.yyyy.' } } },
    { name: 'season', type: 'relationship', relationTo: 'seasons', label: 'Sezona' },
    { name: 'competition', type: 'relationship', relationTo: 'competitions', label: 'Takmičenje' },
    { name: 'file', type: 'upload', relationTo: 'media', label: 'Fajl (PDF)' },
    {
      name: 'attachments',
      type: 'array',
      label: 'Dodatni prilozi',
      fields: [
        { name: 'label', type: 'text', label: 'Naziv' },
        { name: 'file', type: 'upload', relationTo: 'media', required: true, label: 'Fajl' },
      ],
    },
    { name: 'body', type: 'richText', label: 'Tekst' },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      label: 'Arhivirano',
      admin: { position: 'sidebar', description: 'Dokumenta se ne brišu, samo arhiviraju.' },
    },
    ...legacyFields({ html: true }),
  ],
}
