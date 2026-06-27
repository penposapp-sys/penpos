import React from 'react'
import { useTheme } from '../context/ThemeContext.jsx'
import { PanelField, panelInputStyle } from './helpers.jsx'

export function ThemeSettingsPanel() {
  const { theme, setTheme } = useTheme()

  const updateTheme = (key, value) => {
    setTheme({ ...theme, [key]: value })
  }

  return (
    <div style={{ padding: 20 }}>
      <h3 style={{ marginTop: 0, fontSize: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>
        Global Tema Ayarları
      </h3>

      <PanelField label="Ana Renk">
        <input
          type="color"
          value={theme.primaryColor}
          onChange={(event) => updateTheme('primaryColor', event.target.value)}
          style={panelInputStyle({ padding: 4, height: 48 })}
        />
      </PanelField>

      <PanelField label="Metin / İkincil Renk">
        <input
          type="color"
          value={theme.secondaryColor}
          onChange={(event) => updateTheme('secondaryColor', event.target.value)}
          style={panelInputStyle({ padding: 4, height: 48 })}
        />
      </PanelField>

      <PanelField label="Font Ailesi">
        <select
          value={theme.fontFamily}
          onChange={(event) => updateTheme('fontFamily', event.target.value)}
          style={panelInputStyle()}
        >
          <option value='system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'>Modern</option>
          <option value='Georgia, "Times New Roman", serif'>Klasik</option>
          <option value='"Courier New", monospace'>Teknoloji</option>
        </select>
      </PanelField>

      <PanelField label="Köşe Yuvarlaklığı">
        <input
          type="range"
          min="0"
          max="24"
          value={Number.parseInt(String(theme.borderRadius || '8px').replace('px', ''), 10) || 8}
          onChange={(event) => updateTheme('borderRadius', `${event.target.value}px`)}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: 12, color: '#6b7280' }}>{theme.borderRadius}</div>
      </PanelField>
    </div>
  )
}
