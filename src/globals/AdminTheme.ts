import type { Field, GlobalConfig } from 'payload'

import { hiddenUnlessSuperAdmin, isSuperAdmin } from '../access/roles'
import { PRESETS } from '../admin/theme'

const colorField = (name: string, label: string, cssVar: string, description: string): Field => ({
  name,
  type: 'text',
  label,
  admin: { description, components: { Field: { path: '/admin/components/ColorField#ColorField', clientProps: { cssVar } } } },
  validate: (v: unknown) => (!v || /^#[0-9a-f]{6}$/i.test(String(v))) || 'Unesi boju u obliku #rrggbb',
})

/** Izgled admina: menja se bez koda (Sistem → Izgled admina). Vidi i src/admin/theme.ts. */
export const AdminTheme: GlobalConfig = {
  slug: 'admin-theme',
  label: 'Izgled admina',
  admin: { group: 'Sistem', hidden: hiddenUnlessSuperAdmin, description: 'Boje i oblik administracije. Promene se vide odmah (pregled), a čuvaju se dugmetom Sačuvaj.' },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    { name: 'preview', type: 'ui', admin: { components: { Field: '/admin/components/ThemePreview#ThemePreview' } } },
    { name: 'appName', type: 'text', label: 'Naziv aplikacije', defaultValue: 'KSS CMS' },
    {
      name: 'preset',
      type: 'select',
      label: 'Šema boja',
      defaultValue: 'kss',
      options: [...Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })), { value: 'custom', label: 'Prilagođeno…' }],
    },
    {
      name: 'colors',
      type: 'group',
      label: 'Prilagođene boje',
      admin: { condition: (_, siblings) => siblings?.preset === 'custom' },
      fields: [
        {
          type: 'row',
          fields: [
            colorField('primary', 'Glavna boja', '--kss-primary', 'Dugmad, aktivne stavke, naglašeni delovi.'),
            colorField('accent', 'Dodatna boja', '--kss-accent', 'Oznake, linkovi i manji akcenti.'),
          ],
        },
        {
          type: 'row',
          fields: [
            colorField('sidebar', 'Boja bočnog menija', '--kss-sidebar-bg', 'Pozadina menija levo (tamni stil).'),
            colorField('background', 'Pozadina stranice', '--kss-bg', 'Svetla pozadina iza kartica.'),
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'radius',
          type: 'select',
          label: 'Zaobljenost uglova',
          defaultValue: 'soft',
          options: [
            { value: 'sharp', label: 'Oštri' },
            { value: 'soft', label: 'Blago zaobljeni' },
            { value: 'round', label: 'Jako zaobljeni' },
          ],
        },
        {
          name: 'sidebarStyle',
          type: 'select',
          label: 'Bočni meni',
          defaultValue: 'dark',
          options: [
            { value: 'dark', label: 'Tamni' },
            { value: 'light', label: 'Svetli' },
          ],
        },
      ],
    },
  ],
}
