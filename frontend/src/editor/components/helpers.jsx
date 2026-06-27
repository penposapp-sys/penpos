import React from 'react'

export function panelInputStyle(extra = {}) {
  return {
    width: '100%',
    minHeight: 40,
    borderRadius: 10,
    border: '1px solid #d1d5db',
    padding: '10px 12px',
    fontSize: 14,
    ...extra,
  }
}

export function PanelField({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>{label}</span>
      {children}
    </label>
  )
}

export function clampNumber(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  if (Number.isFinite(min) && parsed < min) return min
  if (Number.isFinite(max) && parsed > max) return max
  return parsed
}

export const defaultStyleProps = {
  margin: '0px',
  padding: '20px 30px',
  width: 'auto',
  maxWidth: 'none',
  minHeight: '0px',
  backgroundColor: 'transparent',
  borderRadius: '0px',
  borderWidth: '0px',
  borderStyle: 'solid',
  borderColor: '#d1d5db',
  boxShadow: 'none',
  opacity: 1,
}

export function withDefaultStyleProps(props = {}, overrides = {}) {
  return {
    ...defaultStyleProps,
    ...props,
    ...overrides,
  }
}

export function getCommonWrapperStyle(props = {}, extra = {}) {
  const style = withDefaultStyleProps(props)
  return {
    margin: style.margin,
    padding: style.padding,
    width: style.width,
    maxWidth: style.maxWidth,
    minHeight: style.minHeight,
    background: style.backgroundColor,
    borderRadius: style.borderRadius,
    borderWidth: style.borderWidth,
    borderStyle: style.borderStyle,
    borderColor: style.borderColor,
    boxShadow: style.boxShadow,
    opacity: style.opacity,
    boxSizing: 'border-box',
    ...extra,
  }
}

export function CommonStyleSettings({ props, setProp }) {
  const style = withDefaultStyleProps(props)

  return (
    <>
      <PanelField label="Padding">
        <input
          value={style.padding}
          onChange={(event) => setProp((draft) => { draft.padding = event.target.value })}
          style={panelInputStyle()}
          placeholder="20px 30px"
        />
      </PanelField>

      <PanelField label="Margin">
        <input
          value={style.margin}
          onChange={(event) => setProp((draft) => { draft.margin = event.target.value })}
          style={panelInputStyle()}
          placeholder="0px auto 20px"
        />
      </PanelField>

      <PanelField label="Genislik">
        <input
          value={style.width}
          onChange={(event) => setProp((draft) => { draft.width = event.target.value })}
          style={panelInputStyle()}
          placeholder="auto, 100%, 320px"
        />
      </PanelField>

      <PanelField label="Maksimum Genislik">
        <input
          value={style.maxWidth}
          onChange={(event) => setProp((draft) => { draft.maxWidth = event.target.value })}
          style={panelInputStyle()}
          placeholder="none, 1200px"
        />
      </PanelField>

      <PanelField label="Minimum Yukseklik">
        <input
          value={style.minHeight}
          onChange={(event) => setProp((draft) => { draft.minHeight = event.target.value })}
          style={panelInputStyle()}
          placeholder="0px, 240px"
        />
      </PanelField>

      <PanelField label="Arka Plan">
        <input
          type="color"
          value={String(style.backgroundColor || 'transparent').startsWith('#') ? style.backgroundColor : '#ffffff'}
          onChange={(event) => setProp((draft) => { draft.backgroundColor = event.target.value })}
          style={panelInputStyle({ height: 46, padding: 4 })}
        />
      </PanelField>

      <PanelField label="Kose Yumusatma">
        <input
          value={style.borderRadius}
          onChange={(event) => setProp((draft) => { draft.borderRadius = event.target.value })}
          style={panelInputStyle()}
          placeholder="0px, 16px"
        />
      </PanelField>

      <PanelField label="Border Kalinligi">
        <input
          value={style.borderWidth}
          onChange={(event) => setProp((draft) => { draft.borderWidth = event.target.value })}
          style={panelInputStyle()}
          placeholder="0px, 1px, 2px"
        />
      </PanelField>

      <PanelField label="Border Stili">
        <select
          value={style.borderStyle}
          onChange={(event) => setProp((draft) => { draft.borderStyle = event.target.value })}
          style={panelInputStyle()}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="double">Double</option>
        </select>
      </PanelField>

      <PanelField label="Border Rengi">
        <input
          type="color"
          value={String(style.borderColor || '#d1d5db').startsWith('#') ? style.borderColor : '#d1d5db'}
          onChange={(event) => setProp((draft) => { draft.borderColor = event.target.value })}
          style={panelInputStyle({ height: 46, padding: 4 })}
        />
      </PanelField>

      <PanelField label="Golge">
        <input
          value={style.boxShadow}
          onChange={(event) => setProp((draft) => { draft.boxShadow = event.target.value })}
          style={panelInputStyle()}
          placeholder="none, 0 10px 30px rgba(0,0,0,0.12)"
        />
      </PanelField>

      <PanelField label={`Opaklik (${style.opacity})`}>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={Number(style.opacity) || 1}
          onChange={(event) => setProp((draft) => { draft.opacity = Number(event.target.value) })}
          style={{ width: '100%' }}
        />
      </PanelField>
    </>
  )
}
