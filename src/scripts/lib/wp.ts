/**
 * Zajedničke funkcije za uvoz iz WordPress-a (posts, pages): preuzimanje, mediji, HTML → Lexical.
 */
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import { appendFileSync, mkdirSync } from 'node:fs'
import type { Payload } from 'payload'

// `payload run` guta argumente sa "--", pa se parametri zadaju bez crtica: site=lige limit=50 media
export const parseArgs = (): Record<string, string> =>
  Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a !== '--')
      .map((a) => {
        const [k, v] = a.replace(/^--/, '').split('=')
        return [k, v ?? 'true']
      }),
  )

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function wpFetch(url: string, tries = 4): Promise<Response> {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'kss-migration/1.0' }, signal: AbortSignal.timeout(30_000) })
      if (res.ok || res.status === 404 || res.status === 400) return res
      if (i === tries) return res
    } catch (e) {
      if (i === tries) throw e
    }
    await sleep(500 * i)
  }
  throw new Error('unreachable')
}

export async function pMap<T>(items: T[], fn: (item: T, index: number) => Promise<void>, n: number) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        await fn(items[i], i)
      }
    }),
  )
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—' }
export const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
export const stripTags = (s: string) => decode(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())

const SHORTCODE = /\[\/?(?:separator|fusion_\w+|gallery|caption|embed|video|audio|playlist|vc_\w+|et_pb_\w+|youtube)\b[^\]]*\]/gi

// Konvertor ostavlja ID slike kao tekst i ubacuje slike u paragrafe; Payload traži broj i blok.
type LexNode = { type: string; text?: string; value?: unknown; children?: LexNode[]; [k: string]: unknown }
export function normalizeBody(state: { root: { children: LexNode[] } }) {
  const upload = (n: LexNode): LexNode => ({ ...n, value: Number(n.value) })
  const isBlank = (n: LexNode) => n.type === 'paragraph' && (n.children ?? []).every((c) => c.type === 'linebreak' || (c.type === 'text' && !c.text?.trim()))
  const out: LexNode[] = []
  for (const node of state.root.children as LexNode[]) {
    if (node.type === 'upload') {
      out.push(upload(node))
    } else if (node.type === 'paragraph' && node.children?.some((c) => c.type === 'upload')) {
      let buf: LexNode[] = []
      const flush = () => {
        const para = { ...node, children: buf }
        if (!isBlank(para)) out.push(para)
        buf = []
      }
      for (const c of node.children) {
        if (c.type === 'upload') {
          flush()
          out.push(upload(c))
        } else buf.push(c)
      }
      flush()
    } else if (!isBlank(node)) {
      out.push(node)
    }
  }
  state.root.children = out
  return state
}

const DOC_LINK = /\.(pdf|docx?|xlsx?|pptx?|zip)(\?|$)/i

/** Linkovi na fajlove koje smo preuzeli postaju interni linkovi na Media (ne pucaju kad se WP ugasi / pređe na S3). */
function rewriteDocLinks(node: LexNode, docIds: Map<string, number>, abs: (u: string) => string) {
  const fields = node.fields as { url?: string } | undefined
  if (node.type === 'link' && fields?.url) {
    const id = docIds.get(abs(fields.url))
    if (id) node.fields = { linkType: 'internal', doc: { relationTo: 'media', value: id }, newTab: true }
  }
  for (const c of node.children ?? []) rewriteDocLinks(c, docIds, abs)
}

export type ImportStats = Record<string, number>

export async function createImportContext(opts: {
  payload: Payload
  tenantId: number
  origin: string
  withMedia: boolean
  label: string
}) {
  const { payload, tenantId, origin, withMedia, label } = opts
  mkdirSync('.import-logs', { recursive: true })
  const logFile = `.import-logs/${label}-${new Date().toISOString().slice(0, 10)}.log`
  const logErr = (msg: string) => appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`)
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, failed: 0, media: 0, mediaFailed: 0 }
  const editorConfig = await editorConfigFactory.default({ config: payload.config })
  const abs = (u: string) => new URL(u, origin).toString()

  const mediaCache = new Map<string, number | null>()
  async function importMedia(url: string, alt?: string): Promise<number | null> {
    if (!withMedia) return null
    if (mediaCache.has(url)) return mediaCache.get(url)!
    const promise = (async () => {
      try {
        const existing = await payload.find({
          collection: 'media',
          where: { and: [{ tenant: { equals: tenantId } }, { legacyUrl: { equals: url } }] },
          limit: 1,
          depth: 0,
        })
        if (existing.docs[0]) return existing.docs[0].id
        // inline slike su često umanjene (-300x200.jpg); pokušaj original pa traženi URL
        const candidates = [url.replace(/-\d{2,4}x\d{2,4}(?=\.\w{3,4}$)/, ''), url].filter((u, i, a) => a.indexOf(u) === i)
        for (const candidate of candidates) {
          const res = await wpFetch(candidate)
          if (!res.ok) continue
          const data = Buffer.from(await res.arrayBuffer())
          const name = decodeURIComponent(new URL(candidate).pathname.split('/').pop() || 'file')
          const mimetype = res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream'
          const doc = await payload.create({
            collection: 'media',
            data: { alt: alt || undefined, tenant: tenantId, legacyUrl: url },
            file: { data, mimetype, name, size: data.length },
          })
          stats.media++
          return doc.id
        }
        stats.mediaFailed++
        logErr(`MEDIA 404 ${url}`)
        return null
      } catch (e) {
        stats.mediaFailed++
        logErr(`MEDIA ERR ${url} ${(e as Error).message}`)
        return null
      }
    })()
    mediaCache.set(url, null) // privremeno, da paralelni pozivi ne dupliraju
    const id = await promise
    mediaCache.set(url, id)
    return id
  }

  async function htmlToBody(html: string): Promise<{ body?: unknown; pdfs: string[] }> {
    // ostaci shortcode-a (Avada, galerije…) ne smeju da završe kao vidljiv tekst
    html = html.replace(SHORTCODE, '')
    const doc = new JSDOM(`<body>${html}</body>`).window.document
    doc.querySelectorAll('script, style, iframe, noscript').forEach((n) => n.remove())

    // nevalidni linkovi ruše validaciju Lexical čvora: relativne pretvori u apsolutne, nevalidne razmotaj u tekst
    for (const a of [...doc.querySelectorAll('a')]) {
      const href = (a.getAttribute('href') ?? '').trim()
      if (!href || href.startsWith('#') || /^(mailto|tel):\S+$/i.test(href)) {
        if (!href || href === '#') a.replaceWith(...a.childNodes)
        continue
      }
      try {
        const u = new URL(href, origin)
        if (!/^https?:$/.test(u.protocol)) throw new Error('protocol')
        a.setAttribute('href', u.toString())
      } catch {
        a.replaceWith(...a.childNodes)
      }
    }

    const pdfs = [...doc.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h: string) => /\.pdf(\?|$)/i.test(h))
      .map(abs)

    const docIds = new Map<string, number>()
    if (withMedia) {
      for (const a of [...doc.querySelectorAll('a[href]')]) {
        const href = a.getAttribute('href') || ''
        if (!DOC_LINK.test(href)) continue
        const url = abs(href)
        if (docIds.has(url)) continue
        const id = await importMedia(url, a.textContent?.trim() || undefined)
        if (id) docIds.set(url, id)
      }
    }

    for (const img of [...doc.querySelectorAll('img')]) {
      const src = img.getAttribute('data-orig-file') || img.getAttribute('data-src') || img.getAttribute('src')
      const id = src ? await importMedia(abs(src), img.getAttribute('alt') || undefined) : null
      if (id) {
        const el = doc.createElement('img')
        el.setAttribute('data-lexical-upload-id', String(id))
        el.setAttribute('data-lexical-upload-relation-to', 'media')
        img.replaceWith(el)
      } else {
        img.remove()
      }
    }
    // prazni paragrafi i ostaci galerija
    doc.querySelectorAll('p, div, figure').forEach((n: Element) => {
      if (!n.textContent?.trim() && !n.querySelector('img')) n.remove()
    })
    const cleaned = doc.body.innerHTML.trim()
    if (!cleaned) return { pdfs }
    const body = normalizeBody(convertHTMLToLexical({ editorConfig, html: cleaned, JSDOM }) as never)
    if (docIds.size) rewriteDocLinks(body.root as unknown as LexNode, docIds, abs)
    return { body, pdfs }
  }

  return { logFile, logErr, stats, abs, importMedia, htmlToBody }
}
