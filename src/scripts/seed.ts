/**
 * Lokalni seed: dva sajta (kss, lige) + super-admin.
 * Pokretanje: npm run seed
 * Idempotentno: ponovno pokretanje ne pravi duplikate.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })

const upsertTenant = async (data: {
  name: string
  slug: string
  domain?: string
  primaryColor?: string
  adminColor?: string
}) => {
  const existing = await payload.find({ collection: 'tenants', where: { slug: { equals: data.slug } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({ collection: 'tenants', data: { ...data, type: 'federation' } })
}

const kss = await upsertTenant({ name: 'Košarkaški savez Srbije', slug: 'kss', domain: 'kss.rs', primaryColor: '#C8102E', adminColor: '#e5394a' })
const lige = await upsertTenant({ name: 'Lige KSS', slug: 'lige', domain: 'lige.kss.rs', primaryColor: '#C8102E', adminColor: '#3b82f6' })
payload.logger.info(`Sajtovi: kss=${kss.id}, lige=${lige.id}`)

const email = process.env.SEED_ADMIN_EMAIL
const password = process.env.SEED_ADMIN_PASSWORD
if (email && password) {
  const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
  if (!existing.docs[0]) {
    await payload.create({ collection: 'users', data: { email, password, name: 'Administrator', roles: ['super-admin'] } })
    payload.logger.info(`Napravljen super-admin ${email}`)
  } else {
    payload.logger.info(`Super-admin ${email} već postoji`)
  }
} else {
  payload.logger.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD nisu postavljeni – preskačem korisnika.')
}

process.exit(0)
