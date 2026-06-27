import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const DividerBlock = (props: any) => {
  const { style, color, thickness } = props
  const { connectors: { connect, drag } } = useNode()

  const resolvedColor = color === 'theme' ? 'var(--primary-color)' : color

  return (
    <div ref={ref => connect(drag(ref as any))} style={getCommonWrapperStyle(props)}>
      <hr style={{ border: 'none', borderTop: `${thickness} ${style} ${resolvedColor}`, margin: 0 }} />
    </div>
  )
}

DividerBlock.craft = {
  displayName: 'Ayirici Cizgi',
  props: { style: 'solid', color: 'theme', thickness: '2px', padding: '20px 30px' },
  related: {
    settings: () => {
      const { actions, style, color, thickness, props } = useNode((node: any) => ({
        style: node.data.props.style,
        color: node.data.props.color,
        thickness: node.data.props.thickness,
        props: node.data.props,
      }))
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Stil</label>
            <select
              value={style}
              onChange={e => actions.setProp((p: any) => { p.style = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="solid">Duz</option>
              <option value="dashed">Kesik</option>
              <option value="dotted">Noktali</option>
              <option value="double">Cift Cizgi</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Renk</label>
            <input
              type="color"
              value={color === 'theme' ? '#3b82f6' : color}
              onChange={e => actions.setProp((p: any) => { p.color = e.target.value })}
              style={{ width: '100%', height: '40px', cursor: 'pointer' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
              Kalinlik: {thickness}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={parseInt(thickness, 10)}
              onChange={e => actions.setProp((p: any) => { p.thickness = `${e.target.value}px` })}
              style={{ width: '100%' }}
            />
          </div>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
