import type { CollectionConfig } from 'payload'

import { enforceTenantRole } from '../access/roles'

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  labels: { singular: 'Sponzor', plural: 'Sponzori' },
  admin: { group: 'Sadržaj', useAsTitle: 'name', defaultColumns: ['name', 'tier', 'order'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('site')] },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Naziv' },
    { name: 'logo', type: 'upload', relationTo: 'media', required: true, label: 'Logo' },
    { name: 'url', type: 'text', label: 'Link' },
    {
      name: 'tier',
      type: 'select',
      defaultValue: 'partner',
      label: 'Nivo',
      options: [
        { label: 'Generalni sponzor', value: 'general' },
        { label: 'Zvanični sponzor', value: 'official' },
        { label: 'Partner', value: 'partner' },
      ],
    },
    { name: 'order', type: 'number', defaultValue: 100, label: 'Redosled' },
  ],
}

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: { singular: 'Baner', plural: 'Baneri' },
  admin: { group: 'Sadržaj', useAsTitle: 'name', defaultColumns: ['name', 'slot', 'activeFrom', 'activeTo'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('site')] },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Naziv' },
    { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Slika' },
    { name: 'url', type: 'text', label: 'Link' },
    {
      name: 'slot',
      type: 'select',
      required: true,
      label: 'Mesto',
      options: [
        { label: 'Početna – vrh', value: 'home-top' },
        { label: 'Bočna traka', value: 'sidebar' },
        { label: 'Traka klubova', value: 'clubs-strip' },
      ],
    },
    { name: 'activeFrom', type: 'date', label: 'Aktivan od' },
    { name: 'activeTo', type: 'date', label: 'Aktivan do' },
  ],
}

/** Mapa starih URL-ova na nove (SEO). Uvozi se iz legacyUrl pri migraciji. */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'Redirekt', plural: 'Redirekti' },
  admin: { group: 'Sistem', useAsTitle: 'from', defaultColumns: ['from', 'to', 'permanent'] },
  access: { read: () => true },
  hooks: { beforeValidate: [enforceTenantRole('adminOnly')] },
  fields: [
    { name: 'from', type: 'text', required: true, index: true, label: 'Sa putanje', admin: { description: 'npr. /pripreme-seniorske-reprezentacije-srbije/' } },
    { name: 'to', type: 'text', required: true, label: 'Na putanju' },
    { name: 'permanent', type: 'checkbox', defaultValue: true, label: 'Trajni (301)' },
  ],
}
