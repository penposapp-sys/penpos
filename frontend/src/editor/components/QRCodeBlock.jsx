import React from 'react'
import { useNode } from '@craftjs/core'
import { QRCodeCanvas } from 'qrcode.react'
import { PanelField, clampNumber, panelInputStyle } from './helpers.jsx'

export function QRCodeBlock({ url, size, fgColor }) {
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <section
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={{ padding: 40, textAlign: 'center', background: '#f8fafc' }}
    >
      <p style={{ marginBottom: 15, color: 'var(--secondary-color)' }}>Menüyü görüntülemek için okutun</p>
      <QRCodeCanvas value={url || 'https://penpos.cloud'} size={clampNumber(size, 150, 80, 320)} fgColor={fgColor || '#000000'} />
    </section>
  )
}

export function QRCodeBlockSettings({ props, setProp }) {
  return (
    <div style={{ padding: 10 }}>
      <PanelField label="Yönlendirilecek Link">
        <input
          type="text"
          value={props.url || ''}
          onChange={(event) => setProp((draft) => { draft.url = event.target.value })}
          style={panelInputStyle()}
        />
      </PanelField>
      <PanelField label="Boyut">
        <input
          type="number"
          min="80"
          max="320"
          value={props.size || 150}
          onChange={(event) => setProp((draft) => { draft.size = clampNumber(event.target.value, 150, 80, 320) })}
          style={panelInputStyle()}
        />
      </PanelField>
      <PanelField label="Kod Rengi">
        <input
          type="color"
          value={props.fgColor || '#000000'}
          onChange={(event) => setProp((draft) => { draft.fgColor = event.target.value })}
          style={panelInputStyle({ padding: 4, height: 48 })}
        />
      </PanelField>
    </div>
  )
}

QRCodeBlock.craft = {
  displayName: 'QR Kod',
  props: {
    url: 'https://penpos.cloud/menu',
    size: 150,
    fgColor: '#000000',
  },
  related: {
    settings: QRCodeBlockSettings,
  },
}
