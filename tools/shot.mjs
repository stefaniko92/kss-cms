// Dev alat: prijavi se u lokalni admin (kredencijali iz .env) i snimi screenshotove.
// node tools/shot.mjs /admin /admin/collections/articles ...   → /tmp/shots/<ime>.png
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const base = process.env.BASE ?? 'http://localhost:3000'
const paths = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: process.env.SCHEME ?? 'light' })
const page = await ctx.newPage()

if (!paths.includes('--nologin')) {
  await page.goto(`${base}/admin/login`)
  await page.fill('input[name=email]', env.SEED_ADMIN_EMAIL)
  await page.fill('input[name=password]', env.SEED_ADMIN_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 })
}
for (const p of paths.filter((x) => x.startsWith('/'))) {
  await page.goto(`${base}${p}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(800)
  if (process.env.NAV) { await page.click('.nav-toggler, button[aria-label*="nav" i]').catch(() => {}); await page.waitForTimeout(600) }
  const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'
  await page.screenshot({ path: `/tmp/shots/${name}.png`, fullPage: Boolean(process.env.FULL) })
  console.log('shot', name)
}
await browser.close()
