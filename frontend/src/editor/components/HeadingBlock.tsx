import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const HeadingBlock = (props: any) => {
  const { text, level, align } = props
  const { connectors: { connect, drag } } = useNode()

  const Tag = level as keyof JSX.IntrinsicElements

  return (
    <div ref={ref => connect(drag(ref as any))} style={getCommonWrapperStyle(props)}>
      <Tag
        style={{
          color: 'var(--secondary-color)',
          textAlign: align,
          margin: 0,
          fontFamily: 'var(--font-family)',
        }}
      >
        {text}
      </Tag>
    </div>
  )
}

HeadingBlock.craft = {
  displayName: 'Baslik',
  props: { text: 'Baslik Metni', level: 'h2', align: 'left', padding: '20px 30px' },
  related: {
    settings: () => {
      const { actions, text, level, align, props } = useNode((node: any) => ({
        text: node.data.props.text,
        level: node.data.props.level,
        align: node.data.props.align,
        props: node.data.props,
      }))

      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Baslik</label>
            <input
              value={text}
              onChange={e => actions.setProp((p: any) => { p.text = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Seviye</label>
            <select
              value={level}
              onChange={e => actions.setProp((p: any) => { p.level = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
              <option value="h5">H5</option>
              <option value="h6">H6</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Hizalama</label>
            <select
              value={align}
              onChange={e => actions.setProp((p: any) => { p.align = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="left">Sol</option>
              <option value="center">Orta</option>
              <option value="right">Sag</option>
            </select>
          </div>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
