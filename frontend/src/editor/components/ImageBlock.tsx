import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const ImageBlock = (props: any) => {
  const { src, alt, width, rounded, link } = props
  const { connectors: { connect, drag } } = useNode()

  const img = (
    <img
      src={src}
      alt={alt}
      style={{
        maxWidth: width,
        width: '100%',
        borderRadius: rounded ? 'var(--border-radius)' : '0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'block',
      }}
    />
  )

  return (
    <div ref={ref => connect(drag(ref as any))} style={getCommonWrapperStyle(props, { textAlign: 'center' })}>
      {link ? <a href={link} target="_blank" rel="noopener noreferrer">{img}</a> : img}
      {alt ? <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px', fontStyle: 'italic' }}>{alt}</p> : null}
    </div>
  )
}

ImageBlock.craft = {
  displayName: 'Resim',
  props: {
    src: 'https://picsum.photos/seed/hero/800/400',
    alt: 'Aciklama',
    width: '100%',
    rounded: true,
    link: '',
    padding: '20px 30px',
  },
  related: {
    settings: () => {
      const { actions, src, alt, width, rounded, link, props } = useNode((node: any) => ({
        src: node.data.props.src,
        alt: node.data.props.alt,
        width: node.data.props.width,
        rounded: node.data.props.rounded,
        link: node.data.props.link,
        props: node.data.props,
      }))
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Resim URL</label>
            <input
              value={src}
              onChange={e => actions.setProp((p: any) => { p.src = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Alt Yazi</label>
            <input
              value={alt}
              onChange={e => actions.setProp((p: any) => { p.alt = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Link</label>
            <input
              value={link}
              onChange={e => actions.setProp((p: any) => { p.link = e.target.value })}
              placeholder="https://..."
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Genislik</label>
            <select
              value={width}
              onChange={e => actions.setProp((p: any) => { p.width = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="25%">25%</option>
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
            </select>
          </div>
          <label style={{ display: 'flex', gap: '8px', fontSize: '13px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={rounded}
              onChange={e => actions.setProp((p: any) => { p.rounded = e.target.checked })}
            />
            Kenarlari Yuvarla
          </label>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
