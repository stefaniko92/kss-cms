'use client'
import { useAllFormFields } from '@payloadcms/ui'
import React, { useEffect } from 'react'

import { buildThemeCss, type ThemeData } from '../theme'

/**
 * Pregled uživo na stranici "Izgled admina": prati polja forme i odmah primenjuje izabranu šemu/boje.
 * Pregled je samo u ovom tabu i nestaje kad se strana napusti; trajno se čuva tek dugmetom "Sačuvaj".
 */
export const ThemePreview = () => {
  const [fields] = useAllFormFields()
  const v = (name: string) => (fields[name]?.value as string | undefined) ?? undefined
  const data: ThemeData = {
    preset: v('preset'),
    radius: v('radius'),
    sidebarStyle: v('sidebarStyle') as ThemeData['sidebarStyle'],
    colors: { primary: v('colors.primary'), accent: v('colors.accent'), sidebar: v('colors.sidebar'), background: v('colors.background') },
  }
  const css = buildThemeCss(data)

  useEffect(() => {
    let el = document.getElementById('kss-theme-preview')
    if (!el) {
      el = document.createElement('style')
      el.id = 'kss-theme-preview'
      // na kraj <body>: mora doći posle server stila (#kss-theme), inače ga on nadjačava
      document.body.appendChild(el)
    }
    el.textContent = css
  }, [css])

  useEffect(() => () => document.getElementById('kss-theme-preview')?.remove(), [])
  return null
}
