import type { CollectionConfig } from 'payload'

import { enforceTenantRole } from '../access/roles'
import { legacyFields } from '../fields/legacy'
import { slugField } from '../fields/slug'

export const NationalTeams: CollectionConfig = {
  slug: 'national-teams',
  labels: { singular: 'Reprezentacija', plural: 'Reprezentacije' },
  admin: { group: 'Reprezentacije', useAsTitle: 'name', defaultColumns: ['name', 'gender', 'ageGroup', 'discipline', 'order'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('teams')] },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Naziv', admin: { description: 'npr. Muška seniorska reprezentacija' } },
    slugField('name'),
    {
      type: 'row',
      fields: [
        {
          name: 'gender',
          type: 'select',
          required: true,
          label: 'Pol',
          options: [
            { label: 'Muška', value: 'm' },
            { label: 'Ženska', value: 'f' },
          ],
        },
        {
          name: 'ageGroup',
          type: 'select',
          required: true,
          label: 'Uzrast',
          options: [
            { label: 'Seniori/ke', value: 'senior' },
            { label: 'U20', value: 'u20' },
            { label: 'U19', value: 'u19' },
            { label: 'U18', value: 'u18' },
            { label: 'U17', value: 'u17' },
            { label: 'U16', value: 'u16' },
            { label: 'Juniori/ke (3×3)', value: 'junior' },
            { label: 'Mladi/e (3×3)', value: 'youth' },
            { label: 'Univerzitetska', value: 'university' },
          ],
        },
        {
          name: 'discipline',
          type: 'select',
          required: true,
          defaultValue: '5x5',
          label: 'Disciplina',
          options: [
            { label: '5×5', value: '5x5' },
            { label: '3×3', value: '3x3' },
          ],
        },
      ],
    },
    { name: 'logo', type: 'upload', relationTo: 'media', label: 'Logo' },
    { name: 'order', type: 'number', defaultValue: 100, label: 'Redosled' },
    ...legacyFields(),
  ],
}

/** Igrač ili trener; jedan zapis kroz sve sezone. */
export const People: CollectionConfig = {
  slug: 'people',
  labels: { singular: 'Osoba', plural: 'Osobe (igrači i treneri)' },
  admin: { group: 'Reprezentacije', useAsTitle: 'fullName', defaultColumns: ['fullName', 'primaryPosition', 'birthDate'], listSearchableFields: ['fullName'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('teams')] },
  fields: [
    { name: 'fullName', type: 'text', required: true, label: 'Ime i prezime' },
    slugField('fullName'),
    { name: 'birthDate', type: 'date', label: 'Datum rođenja', admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy.' } } },
    { name: 'birthYear', type: 'number', label: 'Godište', admin: { description: 'Za mlađe selekcije gde je poznata samo godina.' } },
    { name: 'heightCm', type: 'number', label: 'Visina (cm)' },
    { name: 'primaryPosition', type: 'text', label: 'Pozicija', admin: { description: 'npr. PG, SF/SG, C' } },
    { name: 'photo', type: 'upload', relationTo: 'media', label: 'Fotografija' },
    { name: 'bio', type: 'richText', label: 'Biografija' },
    {
      name: 'legacyNames',
      type: 'array',
      label: 'Drugi oblici imena',
      admin: { description: 'Ćirilica/latinica i varijante pisanja, za deduplikaciju pri migraciji.' },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    ...legacyFields(),
  ],
}

/** Godišnja selekcija (zamenjuje WP stranice tipa "Seniori 2025"). */
export const TeamSeasons: CollectionConfig = {
  slug: 'team-seasons',
  labels: { singular: 'Selekcija (sezona)', plural: 'Selekcije (sezone)' },
  admin: { group: 'Reprezentacije', useAsTitle: 'title', defaultColumns: ['title', 'nationalTeam', 'year'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('teams')] },
  defaultSort: '-year',
  fields: [
    { name: 'nationalTeam', type: 'relationship', relationTo: 'national-teams', required: true, label: 'Reprezentacija' },
    { name: 'year', type: 'number', required: true, index: true, label: 'Godina' },
    { name: 'title', type: 'text', required: true, label: 'Naslov', admin: { description: 'npr. FIBA EuroBasket 2025' } },
    { name: 'competitions', type: 'array', label: 'Takmičenja', fields: [{ name: 'name', type: 'text', required: true }] },
    { name: 'photo', type: 'upload', relationTo: 'media', label: 'Zvanična fotografija' },
    {
      name: 'roster',
      type: 'array',
      label: 'Igrači',
      fields: [
        { name: 'person', type: 'relationship', relationTo: 'people', required: true, label: 'Igrač' },
        {
          type: 'row',
          fields: [
            { name: 'number', type: 'text', label: 'Broj' },
            { name: 'position', type: 'text', label: 'Pozicija' },
            { name: 'clubAtTime', type: 'text', label: 'Klub u to vreme' },
            { name: 'captain', type: 'checkbox', label: 'Kapiten' },
          ],
        },
      ],
    },
    {
      name: 'staff',
      type: 'array',
      label: 'Stručni štab',
      fields: [
        { name: 'person', type: 'relationship', relationTo: 'people', required: true, label: 'Osoba' },
        {
          name: 'role',
          type: 'select',
          required: true,
          label: 'Funkcija',
          options: [
            { label: 'Selektor', value: 'head-coach' },
            { label: 'Pomoćni trener', value: 'assistant' },
            { label: 'Direktor reprezentacije', value: 'director' },
            { label: 'Lekar', value: 'doctor' },
            { label: 'Fizioterapeut', value: 'physio' },
            { label: 'Ostalo', value: 'other' },
          ],
        },
        { name: 'roleLabel', type: 'text', label: 'Naziv funkcije (slobodan tekst)' },
      ],
    },
    {
      name: 'results',
      type: 'array',
      label: 'Rezultati',
      fields: [
        { name: 'date', type: 'date', label: 'Datum' },
        { name: 'opponent', type: 'text', required: true, label: 'Protivnik' },
        { name: 'score', type: 'text', label: 'Rezultat' },
        { name: 'competition', type: 'text', label: 'Takmičenje' },
      ],
    },
    { name: 'body', type: 'richText', label: 'Dodatni tekst' },
    ...legacyFields(),
  ],
}

/** Organi saveza: predsednik, UO, NO, skupština... */
export const OrganMembers: CollectionConfig = {
  slug: 'organ-members',
  labels: { singular: 'Član organa', plural: 'Organi saveza' },
  admin: { group: 'Reprezentacije', useAsTitle: 'role', defaultColumns: ['person', 'organ', 'role', 'order'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('teams')] },
  defaultSort: 'order',
  fields: [
    {
      name: 'organ',
      type: 'select',
      required: true,
      label: 'Organ',
      options: [
        { label: 'Predsednik', value: 'president' },
        { label: 'Potpredsednici', value: 'vice-presidents' },
        { label: 'Generalni sekretar', value: 'secretary-general' },
        { label: 'Upravni odbor', value: 'executive-board' },
        { label: 'Nadzorni odbor', value: 'supervisory-board' },
        { label: 'Skupština', value: 'assembly' },
      ],
    },
    { name: 'person', type: 'relationship', relationTo: 'people', required: true, label: 'Osoba' },
    { name: 'role', type: 'text', required: true, label: 'Funkcija' },
    { name: 'order', type: 'number', defaultValue: 100, label: 'Redosled' },
  ],
}
