import React from 'react'

/** Veliki logo (login ekran). */
export const Logo = () => (
  <div className="kss-logo">
    <img src="/brand/kss-logo.png" alt="Košarkaški savez Srbije" height={56} />
    <span className="kss-logo__text">
      <strong>KSS</strong> CMS
    </span>
  </div>
)

/** Ikona (gornji levi ugao admina). */
export const Icon = () => <img src="/brand/kss-logo.png" alt="KSS" className="kss-icon" height={28} />
