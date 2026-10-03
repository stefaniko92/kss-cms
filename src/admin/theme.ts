/**
 * Tema admina: gotove šeme + prilagođene boje (podešavaju se u adminu: Sistem → Izgled admina).
 * `buildThemeCss` pravi CSS promenljive koje koristi custom.scss; zajedničko je za server (ubacuje <style>)
 * i za pregled uživo u biraču boja.
 */
export type ThemeColors = { primary: string; accent: string; sidebar: string; background: string }

export const PRESETS: Record<string, { label: string } & ThemeColors> = {
  kss: { label: 'KSS (teget i crvena)', primary: '#002047', accent: '#bb1b2b', sidebar: '#111822', background: '#f2f3f6' },
  crimson: { label: 'Crvena', primary: '#bb1b2b', accent: '#002047', sidebar: '#1c1215', background: '#f6f3f3' },
  ocean: { label: 'Okean (plava)', primary: '#1d4ed8', accent: '#0ea5e9', sidebar: '#0f172a', background: '#f1f5f9' },
  graphite: { label: 'Grafit (narandžasta)', primary: '#27272a', accent: '#f97316', sidebar: '#18181b', background: '#f4f4f5' },
}

export const RADII: Record<string, number> = { sharp: 2, soft: 6, round: 12 }

export type ThemeData = {
  preset?: string | null
  colors?: Partial<ThemeColors> | null
  radius?: string | null
  sidebarStyle?: 'dark' | 'light' | null
  appName?: string | null
}

const HEX = /^#[0-9a-f]{6}$/i
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback)

/** Boja teksta (bela/tamna) koja se čita na datoj pozadini. */
export function contrastOn(color: string): string {
  const n = parseInt(color.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111111' : '#ffffff'
}

export function resolveTheme(theme?: ThemeData | null) {
  const preset = PRESETS[theme?.preset ?? 'kss'] ?? PRESETS.kss
  const custom = theme?.preset === 'custom'
  const c = custom ? theme?.colors ?? {} : {}
  const colors: ThemeColors = {
    primary: hex(c.primary, preset.primary),
    accent: hex(c.accent, preset.accent),
    sidebar: hex(c.sidebar, preset.sidebar),
    background: hex(c.background, preset.background),
  }
  const radius = RADII[theme?.radius ?? 'soft'] ?? RADII.soft
  const lightSidebar = theme?.sidebarStyle === 'light'
  return { colors, radius, lightSidebar, appName: theme?.appName?.trim() || 'KSS CMS' }
}

export function buildThemeCss(theme?: ThemeData | null): string {
  const { colors, radius, lightSidebar } = resolveTheme(theme)
  const sidebarBg = lightSidebar ? '#ffffff' : colors.sidebar
  const sidebarFg = lightSidebar ? '#1f2933' : contrastOn(colors.sidebar)
  return `:root{
--kss-primary:${colors.primary};
--kss-primary-contrast:${contrastOn(colors.primary)};
--kss-accent:${colors.accent};
--kss-accent-contrast:${contrastOn(colors.accent)};
--kss-sidebar-bg:${sidebarBg};
--kss-sidebar-fg:${sidebarFg};
--kss-bg:${colors.background};
--kss-radius:${radius}px;
--kss-radius-l:${radius * 2}px;
}`
}
