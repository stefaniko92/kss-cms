import type { ServerProps } from 'payload'
import React from 'react'

import { ThemeStyle } from './ThemeStyle'

/** Leva (brend) strana prijave; raspored dvoje kolona radi custom.scss. */
export async function LoginBrand(props: ServerProps) {
  return (
    <>
      <ThemeStyle {...props} />
      <aside className="kss-login-brand" aria-hidden="false">
        <img src="/brand/kss-logo-white.png" alt="" className="kss-login-brand__logo" />
        <h2>Dobrodošli u KSS CMS</h2>
        <p>Jedno mesto za upravljanje sajtovima Košarkaškog saveza Srbije: vesti, reprezentacije, takmičenja i dokumenta.</p>
        <ul>
          <li>kss.rs i lige.kss.rs</li>
          <li>Rezultati i tabele automatski iz DScore-a</li>
          <li>Pristup po ulogama: svako vidi svoje</li>
        </ul>
      </aside>
    </>
  )
}
