import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const ButtonBlock = (props: any) => {
  const { text, link, style, target } = props
  const { connectors: { connect, drag } } = useNode()

  const styles: any = {
    primary: { background: 'var(--primary-color)', color: 'white' },
    secondary: { background: 'transparent', color: 'var(--primary-color)', border: '2px solid var(--primary-color)' },
    dark: { background: 'var(--secondary-color)', color: 'white' },
  }

  return (
    <div ref={ref => connect(drag(ref as any))} style={getCommonWrapperStyle(props, { textAlign: 'center' })}>
      <a
        href={link || '#'}
        target={target}
        style={{
          display: 'inline-block',
          padding: '14px 32px',
          borderRadius: 'var(--border-radius)',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          ...styles[style],
        }}
      >
        {text}
      </a>
    </div>
  )
}

ButtonBlock.craft = {
  displayName: 'Buton',
  props: { text: 'Butona Tikla', link: '#', style: 'primary', target: '_self', padding: '20px 30px' },
  related: {
    settings: () => {
      const { actions, text, link, style, target, props } = useNode((node: any) => ({
        text: node.data.props.text,
        link: node.data.props.link,
        style: node.data.props.style,
        target: node.data.props.target,
        props: node.data.props,
      }))
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Buton Yazisi</label>
            <input
              value={text}
              onChange={e => actions.setProp((p: any) => { p.text = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Link URL</label>
            <input
              value={link}
              onChange={e => actions.setProp((p: any) => { p.link = e.target.value })}
              placeholder="https://..."
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Stil</label>
            <select
              value={style}
              onChange={e => actions.setProp((p: any) => { p.style = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="primary">Ana Renk</option>
              <option value="secondary">Cerceve</option>
              <option value="dark">Koyu</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Hedef</label>
            <select
              value={target}
              onChange={e => actions.setProp((p: any) => { p.target = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="_self">Ayni Sekme</option>
              <option value="_blank">Yeni Sekme</option>
            </select>
          </div>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
