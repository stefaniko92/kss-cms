import type { Field } from 'payload'

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj',
  м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's',
}

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[а-џ]/g, (c) => CYR[c] ?? c)
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Slug iz izvornog polja ako nije ručno unet. TODO: jedinstvenost po sajtu (tenant + slug) još nije proveravana. */
export const slugField = (source = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  index: true,
  label: 'Slug',
  admin: { position: 'sidebar' },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === 'string' && value.trim()) return slugify(value)
        const from = data?.[source]
        return typeof from === 'string' ? slugify(from) : value
      },
    ],
  },
})
