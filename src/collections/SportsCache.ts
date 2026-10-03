import type { CollectionConfig } from 'payload'

/**
 * Keš normalizovanih sportskih podataka (DScore). Nije za ručno uređivanje:
 * sakriven u adminu, bez pristupa preko REST/GraphQL; koristi se samo kroz Local API.
 */
export const SportsCache: CollectionConfig = {
  slug: 'sports-cache',
  labels: { singular: 'Sportski keš', plural: 'Sportski keš' },
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: ['leagues', 'league', 'standings', 'schedule', 'match', 'leaders'].map((v) => ({ label: v, value: v })),
    },
    { name: 'leagueId', type: 'number', index: true },
    { name: 'finished', type: 'checkbox', defaultValue: false, index: true },
    { name: 'data', type: 'json', required: true },
    { name: 'fetchedAt', type: 'date', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
}
