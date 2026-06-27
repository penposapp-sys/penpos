import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle, PanelField, panelInputStyle } from './helpers.jsx'

export function Hero(props) {
  const {
    title,
    subtitle,
    bgColor,
    btnText,
    buttonLink = '#',
    align = 'center',
    padding = '80px 20px',
  } = props

  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <section
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={getCommonWrapperStyle(props, {
        background: bgColor || 'var(--primary-color)',
        padding,
        textAlign: align,
        color: 'white',
      })}
    >
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 3.4rem)', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: '1.1rem', marginTop: 12, opacity: 0.92, lineHeight: 1.6 }}>{subtitle}</p>
        <a
          href={buttonLink || '#'}
          onClick={(event) => event.preventDefault()}
          style={{
            display: 'inline-flex',
            marginTop: 20,
            padding: '12px 30px',
            background: 'white',
            color: bgColor || 'var(--primary-color)',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            fontSize: '1rem',
            cursor: 'pointer',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          {btnText}
        </a>
      </div>
    </section>
  )
}

export function HeroSettings({ props, setProp }) {
  return (
    <div style={{ padding: 10 }}>
      <PanelField label="Baslik">
        <input
          type="text"
          value={props.title || ''}
          onChange={(event) => setProp((draft) => { draft.title = event.target.value })}
          style={panelInputStyle()}
        />
      </PanelField>
      <PanelField label="Alt Baslik">
        <textarea
          value={props.subtitle || ''}
          onChange={(event) => setProp((draft) => { draft.subtitle = event.target.value })}
          style={panelInputStyle({ minHeight: 92, resize: 'vertical' })}
        />
      </PanelField>
      <PanelField label="Arka Plan Rengi">
        <input
          type="color"
          value={props.bgColor || '#3b82f6'}
          onChange={(event) => setProp((draft) => { draft.bgColor = event.target.value })}
          style={panelInputStyle({ padding: 4, height: 48 })}
        />
      </PanelField>
      <PanelField label="Buton Yazisi">
        <input
          type="text"
          value={props.btnText || ''}
          onChange={(event) => setProp((draft) => { draft.btnText = event.target.value })}
          style={panelInputStyle()}
        />
      </PanelField>
      <PanelField label="Buton Linki">
        <input
          type="text"
          value={props.buttonLink || ''}
          onChange={(event) => setProp((draft) => { draft.buttonLink = event.target.value })}
          style={panelInputStyle()}
          placeholder="/menu/ornek"
        />
      </PanelField>
      <CommonStyleSettings props={props} setProp={setProp} />
    </div>
  )
}

Hero.craft = {
  displayName: 'Hero Banner',
  props: {
    title: 'Isletmenize Hos Geldiniz',
    subtitle: 'En iyi hizmeti sunuyoruz',
    bgColor: 'var(--primary-color)',
    btnText: 'Incele',
    buttonLink: '#',
    align: 'center',
    padding: '80px 20px',
  },
  related: {
    settings: HeroSettings,
  },
}
