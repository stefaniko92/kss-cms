import type { CollectionConfig } from 'payload'

import { enforceTenantRole } from '../access/roles'
import { legacyFields } from '../fields/legacy'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Medij', plural: 'Mediji' },
  access: {
    read: () => true,
  },
  hooks: { beforeValidate: [enforceTenantRole('content')] },
  admin: { group: 'Sadržaj', useAsTitle: 'filename', defaultColumns: ['filename', 'alt', 'credit'] },
  fields: [
    { name: 'alt', type: 'text', label: 'Alt tekst' },
    { name: 'credit', type: 'text', label: 'Autor / izvor fotografije' },
    ...legacyFields(),
  ],
  upload: {
    // Za produkciju: S3/R2 storage adapter + CDN. Lokalno se čuva u /media.
    mimeTypes: [
      'image/*',
      'application/pdf',
      'video/mp4',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
    ],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, fit: 'cover' },
      { name: 'card', width: 800, height: 450, fit: 'cover' },
      { name: 'hero', width: 1600, height: 900, fit: 'cover' },
    ],
    formatOptions: { format: 'webp' },
  },
}
