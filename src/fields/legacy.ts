import type { Field } from 'payload'

/** Tragovi starog WordPress sajta: omogućavaju ponovljivu migraciju i redirekte. */
export const legacyFields = (opts: { html?: boolean } = {}): Field[] => [
  {
    type: 'collapsible',
    label: 'Migracija (WordPress)',
    admin: { initCollapsed: true },
    fields: [
      {
        name: 'legacyId',
        type: 'number',
        index: true,
        label: 'Stari WP ID',
        admin: { readOnly: true },
      },
      {
        name: 'legacyUrl',
        type: 'text',
        label: 'Stari URL',
        admin: { readOnly: true },
      },
      ...(opts.html
        ? ([
            {
              name: 'legacyHtml',
              type: 'textarea',
              maxLength: 5_000_000,
              label: 'Originalni HTML',
              admin: { readOnly: true, description: 'Sadržaj kakav je bio u WordPress-u; omogućava ponovnu konverziju.' },
            },
          ] as Field[])
        : []),
    ],
  },
]
