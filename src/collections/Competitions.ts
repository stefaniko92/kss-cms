import type { CollectionConfig } from 'payload'

import { enforceTenantRole } from '../access/roles'
import { slugField } from '../fields/slug'

/** Stabilan entitet takmičenja (2. MLS, 1. MRL Sever, ARDU JLS…). */
export const Competitions: CollectionConfig = {
  slug: 'competitions',
  labels: { singular: 'Takmičenje', plural: 'Takmičenja' },
  admin: { group: 'Takmičenja', useAsTitle: 'name', defaultColumns: ['name', 'group', 'gender', 'order'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('competitions')] },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Naziv' },
    { name: 'shortName', type: 'text', label: 'Skraćeni naziv' },
    slugField('name'),
    {
      type: 'row',
      fields: [
        {
          name: 'group',
          type: 'select',
          required: true,
          label: 'Grupa',
          options: [
            { label: 'Seniori', value: 'seniori' },
            { label: 'Seniorke', value: 'seniorke' },
            { label: 'Kup', value: 'kup' },
            { label: 'Mlađe kategorije', value: 'mladje-kategorije' },
          ],
        },
        {
          name: 'gender',
          type: 'select',
          label: 'Pol',
          options: [
            { label: 'Muški', value: 'm' },
            { label: 'Ženski', value: 'f' },
          ],
        },
        { name: 'level', type: 'number', label: 'Rang (1 = najviši)' },
      ],
    },
    { name: 'parent', type: 'relationship', relationTo: 'competitions', label: 'Nadređeno takmičenje', admin: { description: 'npr. 1. MRL Sever → 1. MRL' } },
    { name: 'logo', type: 'upload', relationTo: 'media', label: 'Logo' },
    { name: 'color', type: 'text', label: 'Boja' },
    { name: 'order', type: 'number', defaultValue: 100, label: 'Redosled' },
    {
      name: 'dscoreCategoryId',
      type: 'number',
      label: 'DScore kategorija',
      admin: { description: 'ID kategorije u DScore-u (/categories), npr. 72 = Seniori.' },
    },
    { name: 'description', type: 'richText', label: 'Opis' },
  ],
}

export const Seasons: CollectionConfig = {
  slug: 'seasons',
  labels: { singular: 'Sezona', plural: 'Sezone' },
  admin: { group: 'Takmičenja', useAsTitle: 'label', defaultColumns: ['label', 'startDate', 'endDate', 'current'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('competitions')] },
  defaultSort: '-startDate',
  fields: [
    { name: 'label', type: 'text', required: true, label: 'Oznaka', admin: { description: 'npr. 2025/26' } },
    { name: 'startDate', type: 'date', label: 'Početak', admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy.' } } },
    { name: 'endDate', type: 'date', label: 'Kraj', admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy.' } } },
    { name: 'current', type: 'checkbox', defaultValue: false, label: 'Tekuća sezona' },
  ],
}

/**
 * Faza/grupa takmičenja u sezoni. Zamenjuje ručno pravljenje WP stranica po fazi.
 * ID DScore lige je po sezoni/fazi (npr. 2. MLS: 184 u 2025/26, 284 u 2026/27).
 */
export const CompetitionPhases: CollectionConfig = {
  slug: 'competition-phases',
  labels: { singular: 'Faza takmičenja', plural: 'Faze takmičenja' },
  admin: { group: 'Takmičenja', useAsTitle: 'name', defaultColumns: ['name', 'competition', 'season', 'type', 'dscoreLeagueId', 'published'] },
  access: { read: ({ req }) => (req.user ? true : { published: { equals: true } }) },
  hooks: { beforeValidate: [enforceTenantRole('competitions')] },
  defaultSort: 'order',
  fields: [
    { name: 'competition', type: 'relationship', relationTo: 'competitions', required: true, label: 'Takmičenje' },
    { name: 'season', type: 'relationship', relationTo: 'seasons', required: true, label: 'Sezona' },
    { name: 'name', type: 'text', required: true, label: 'Naziv', admin: { description: 'npr. Grupa B, Play-off' } },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'regular',
      label: 'Tip',
      options: [
        { label: 'Regularni deo', value: 'regular' },
        { label: 'Grupa', value: 'group' },
        { label: 'Play-off', value: 'play-off' },
        { label: 'Play-out', value: 'play-out' },
        { label: 'Finalni turnir', value: 'final-tournament' },
        { label: 'Kvalifikacije', value: 'qualification' },
      ],
    },
    {
      name: 'dscoreLeagueId',
      type: 'number',
      index: true,
      label: 'DScore ID lige',
      admin: { description: 'ID lige u DScore-u (GET /leagues). Prazno ako se faza ne vodi u DScore-u.' },
    },
    {
      name: 'statsSource',
      type: 'select',
      defaultValue: 'dscore',
      label: 'Izvor statistike',
      options: [
        { label: 'DScore', value: 'dscore' },
        { label: 'kss-live', value: 'kss-live' },
        { label: 'Nema', value: 'none' },
      ],
    },
    { name: 'kssLiveSlug', type: 'text', label: 'kss-live slug', admin: { description: 'npr. 2mls' } },
    { name: 'order', type: 'number', defaultValue: 100, label: 'Redosled' },
    { name: 'published', type: 'checkbox', defaultValue: true, label: 'Objavljeno' },
  ],
}
