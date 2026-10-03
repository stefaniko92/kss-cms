/**
 * Provera dozvola (regresioni test, radi nad lokalnom bazom). Pokretanje: npm run verify:access
 * Pravi privremene korisnike i sadržaj, proverava pristup i sve obriše.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })

let failed = 0
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}
const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return false
  } catch {
    return true
  }
}

const tenant = async (slug: string) =>
  (await payload.find({ collection: 'tenants', where: { slug: { equals: slug } }, limit: 1 })).docs[0]
const kss = await tenant('kss')
const lige = await tenant('lige')
if (!kss || !lige) throw new Error('Pokreni prvo: npm run seed')

const stamp = Date.now()
const pw = `Tmp-${stamp}-x`
const mkUser = (tag: string, tenants: { tenant: number; roles: string[] }[]) =>
  payload.create({
    collection: 'users',
    data: { email: `verify-${tag}-${stamp}@kss.local`, password: pw, tenants: tenants as never },
  })

const news = await mkUser('news', [{ tenant: kss.id, roles: ['news-editor'] }])
const comp = await mkUser('comp', [{ tenant: lige.id, roles: ['competitions-editor'] }])
const created: { collection: string; id: number }[] = []
const track = (collection: string, doc: { id: number }) => {
  created.push({ collection, id: doc.id })
  return doc
}

const as = (user: typeof news) => ({ user: { ...user, collection: 'users' as const }, overrideAccess: false as const })

try {
  // --- Javni pristup
  const draft = track('articles', await payload.create({ collection: 'articles', data: { title: 'Nacrt', tenant: kss.id, _status: 'draft' } as never, draft: true }))
  const pub = track('articles', await payload.create({ collection: 'articles', data: { title: 'Objavljeno', tenant: kss.id, _status: 'published' } as never }))
  const anon = await payload.find({ collection: 'articles', where: { id: { in: [draft.id, pub.id] } }, overrideAccess: false })
  check('anonimac vidi objavljen članak', anon.docs.some((d) => d.id === pub.id))
  check('anonimac NE vidi nacrt', !anon.docs.some((d) => d.id === draft.id))
  check('anonimac čita sajtove', (await payload.find({ collection: 'tenants', overrideAccess: false })).totalDocs >= 2)
  check('anonimac NE može da piše', await throws(() => payload.create({ collection: 'articles', data: { title: 'x', tenant: kss.id } as never, overrideAccess: false })))

  // --- Urednik vesti na kss
  const a = track('articles', await payload.create({ collection: 'articles', data: { title: 'Moj članak', tenant: kss.id, _status: 'published' } as never, ...as(news) }))
  check('urednik vesti piše članak na svom sajtu', Boolean(a.id))
  check('urednik vesti NE piše na tuđem sajtu (lige)', await throws(() => payload.create({ collection: 'articles', data: { title: 'x', tenant: lige.id } as never, ...as(news) })))
  check('urednik vesti NE pravi reprezentaciju (teams)', await throws(() => payload.create({ collection: 'national-teams', data: { name: 'x', gender: 'm', ageGroup: 'senior', discipline: '5x5', tenant: kss.id } as never, ...as(news) })))
  check('urednik vesti NE pravi redirekt (adminOnly)', await throws(() => payload.create({ collection: 'redirects', data: { from: '/a', to: '/b', tenant: kss.id } as never, ...as(news) })))
  const own = await payload.find({ collection: 'articles', ...as(news), limit: 100 })
  check('urednik vesti ne vidi nacrte tuđeg sajta', own.docs.every((d) => (typeof d.tenant === 'object' ? d.tenant?.id : d.tenant) === kss.id))

  // --- Eskalacija privilegija
  await payload.update({ collection: 'users', id: news.id, data: { roles: ['super-admin'] } as never, ...as(news) }).catch(() => null)
  const reread = await payload.findByID({ collection: 'users', id: news.id })
  check('korisnik NE može sam sebi da da super-admin', !reread.roles?.includes('super-admin'))
  await payload.update({ collection: 'users', id: news.id, data: { tenants: [{ tenant: lige.id, roles: ['admin'] }] } as never, ...as(news) }).catch(() => null)
  const reread2 = await payload.findByID({ collection: 'users', id: news.id, depth: 0 })
  check('korisnik NE može sam sebi da doda sajt/ulogu', (reread2.tenants ?? []).every((t) => t.tenant === kss.id))

  // --- Urednik takmičenja na lige
  const c = track('competitions', await payload.create({ collection: 'competitions', data: { name: 'Test liga', group: 'seniori', tenant: lige.id } as never, ...as(comp) }))
  check('urednik takmičenja pravi takmičenje na lige', Boolean(c.id))
  check('urednik takmičenja piše izveštaj na lige', Boolean(track('articles', await payload.create({ collection: 'articles', data: { title: 'Izveštaj', kind: 'match-report', tenant: lige.id } as never, ...as(comp) })).id))
  check('urednik takmičenja NE piše na kss', await throws(() => payload.create({ collection: 'competitions', data: { name: 'x', group: 'seniori', tenant: kss.id } as never, ...as(comp) })))
  check('urednik takmičenja NE pravi stranice (site)', await throws(() => payload.create({ collection: 'pages', data: { title: 'x', tenant: lige.id } as never, ...as(comp) })))
  check('urednik vesti NE menja tuđe takmičenje', await throws(() => payload.update({ collection: 'competitions', id: c.id, data: { name: 'hack' }, ...as(news) })))
} finally {
  for (const { collection, id } of created.reverse()) {
    await payload.delete({ collection: collection as 'articles', id }).catch(() => null)
  }
  await payload.delete({ collection: 'users', id: news.id }).catch(() => null)
  await payload.delete({ collection: 'users', id: comp.id }).catch(() => null)
}

console.log(failed ? `\n${failed} provera NIJE prošlo` : '\nSve provere su prošle')
process.exit(failed ? 1 : 0)
