import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, PanelField, clampNumber, getCommonWrapperStyle, panelInputStyle } from './helpers.jsx'

export function MapBlock(props) {
  const { address, height } = props
  const {
    connectors: { connect, drag },
  } = useNode()
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(address || 'Istanbul, Turkiye')}&t=&z=13&ie=UTF8&iwloc=&output=embed`

  return (
    <section
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={getCommonWrapperStyle(props, { padding: props.padding || 20 })}
    >
      <iframe
        src={mapSrc}
        width="100%"
        height={clampNumber(height, 320, 180, 800)}
        style={{ border: 0, borderRadius: 'var(--border-radius)' }}
        allowFullScreen
        loading="lazy"
        title={address || 'Harita'}
      />
    </section>
  )
}

export function MapBlockSettings({ props, setProp }) {
  return (
    <div style={{ padding: 10 }}>
      <PanelField label="Adres / Konum">
        <input
          type="text"
          value={props.address || ''}
          onChange={(event) => setProp((draft) => { draft.address = event.target.value })}
          style={panelInputStyle()}
        />
      </PanelField>
      <PanelField label="Yukseklik (px)">
        <input
          type="number"
          min="180"
          max="800"
          value={props.height || 320}
          onChange={(event) => setProp((draft) => { draft.height = clampNumber(event.target.value, 320, 180, 800) })}
          style={panelInputStyle()}
        />
      </PanelField>
      <CommonStyleSettings props={props} setProp={setProp} />
    </div>
  )
}

MapBlock.craft = {
  displayName: 'Google Harita',
  props: {
    address: 'Istanbul, Turkiye',
    height: 320,
    padding: '20px',
  },
  related: {
    settings: MapBlockSettings,
  },
}
