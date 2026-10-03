'use client'
import { FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import React, { useEffect, useState } from 'react'

const HEX = /^#[0-9a-f]{6}$/i

/**
 * Birač boje (hex). Pregled uživo radi ThemePreview (čita vrednosti iz forme).
 */
export const ColorField = ({ field, path, cssVar }: TextFieldClientProps & { cssVar?: string }) => {
  const { value, setValue } = useField<string>({ path })
  const valid = typeof value === 'string' && HEX.test(value)
  // dok polje nije popunjeno, prikaži boju koja se trenutno primenjuje (iz šeme)
  const [current, setCurrent] = useState('#000000')
  useEffect(() => {
    if (!cssVar) return
    const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    if (HEX.test(v)) setCurrent(v)
  }, [cssVar])

  return (
    <div className="field-type kss-color-field">
      <FieldLabel label={field?.label} path={path} required={field?.required} />
      <div className="kss-color-field__row">
        <input
          type="color"
          aria-label={typeof field?.label === 'string' ? field.label : 'Boja'}
          value={valid ? value : current}
          onChange={(e) => setValue(e.target.value)}
        />
        <input
          type="text"
          className="kss-color-field__hex"
          value={value ?? ''}
          placeholder={current}
          maxLength={7}
          onChange={(e) => setValue(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
        />
        {!valid && value ? <span className="kss-color-field__error">Unesi boju u obliku #rrggbb</span> : null}
      </div>
    </div>
  )
}
