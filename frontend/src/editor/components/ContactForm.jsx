import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, PanelField, getCommonWrapperStyle, panelInputStyle } from './helpers.jsx'

export function ContactForm(props) {
  const { title, btnText } = props
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <section
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={getCommonWrapperStyle(props, { padding: props.padding || '40px 20px' })}
    >
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ color: 'var(--secondary-color)', textAlign: 'center' }}>{title}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            window.alert('Bu formu kendi backend API endpointinize baglayin.')
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
        >
          <input type="text" placeholder="Adiniz" style={panelInputStyle({ borderRadius: 'var(--border-radius)' })} />
          <input type="email" placeholder="E-posta" style={panelInputStyle({ borderRadius: 'var(--border-radius)' })} />
          <textarea placeholder="Mesajiniz" rows={4} style={panelInputStyle({ minHeight: 110, resize: 'vertical', borderRadius: 'var(--border-radius)' })} />
          <button
            type="submit"
            style={{
              padding: '14px',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {btnText}
          </button>
        </form>
      </div>
    </section>
  )
}

export function ContactFormSettings({ props, setProp }) {
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
      <PanelField label="Buton Yazisi">
        <input
          type="text"
          value={props.btnText || ''}
          onChange={(event) => setProp((draft) => { draft.btnText = event.target.value })}
          style={panelInputStyle()}
        />
      </PanelField>
      <CommonStyleSettings props={props} setProp={setProp} />
    </div>
  )
}

ContactForm.craft = {
  displayName: 'Iletisim Formu',
  props: {
    title: 'Bize Ulasin',
    btnText: 'Gonder',
    padding: '40px 20px',
  },
  related: {
    settings: ContactFormSettings,
  },
}
