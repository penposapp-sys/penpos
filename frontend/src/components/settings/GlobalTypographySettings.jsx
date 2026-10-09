import React from 'react'
import { useGlobalTypography } from '../../context/GlobalTypographyContext.jsx'

const PRESETS = [
  ['small', 'Küçük'],
  ['normal', 'Normal'],
  ['large', 'Büyük'],
]

export default function GlobalTypographySettings() {
  const { preference, sizeBounds, setPreset, setCustomSize } = useGlobalTypography()

  return (
    <section className="card global-typography-settings" aria-labelledby="global-typography-title">
      <div className="global-typography-settings__header">
        <div>
          <h3 id="global-typography-title">Yazı Boyutu</h3>
          <p>Tercihiniz bu cihazda kaydedilir ve uygulamanın tüm ekranlarında kullanılır.</p>
        </div>
        <output className="global-typography-settings__value" htmlFor="global-font-size">
          {preference.size} px
        </output>
      </div>

      <div className="global-typography-settings__presets" role="group" aria-label="Hazır yazı boyutları">
        {PRESETS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="btn"
            aria-pressed={preference.preset === value}
            onClick={() => setPreset(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="global-typography-settings__slider-label" htmlFor="global-font-size">
        Manuel boyut
        <input
          id="global-font-size"
          type="range"
          min={sizeBounds.min}
          max={sizeBounds.max}
          step="1"
          value={preference.size}
          onChange={(event) => setCustomSize(event.target.value)}
          aria-valuetext={`${preference.size} piksel`}
        />
        <span className="global-typography-settings__limits" aria-hidden="true">
          <span>{sizeBounds.min} px</span>
          <span>{sizeBounds.max} px</span>
        </span>
      </label>

      <p className="global-typography-settings__preview">
        Türkçe karakterler: ı İ, ş Ş, ğ Ğ, ü Ü, ö Ö, ç Ç
      </p>
    </section>
  )
}
