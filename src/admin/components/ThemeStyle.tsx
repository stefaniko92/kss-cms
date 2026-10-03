import type { ServerProps } from 'payload'
import '@fontsource-variable/inter'
import React from 'react'

import { buildThemeCss, type ThemeData } from '../theme'

/** Čita global "Izgled admina" i ubacuje CSS promenljive (bez treperenja boja pri učitavanju). */
export async function ThemeStyle({ payload }: ServerProps) {
  const theme = (await payload.findGlobal({ slug: 'admin-theme', depth: 0, overrideAccess: true }).catch(() => null)) as ThemeData | null
  return <style id="kss-theme" dangerouslySetInnerHTML={{ __html: buildThemeCss(theme) }} />
}
