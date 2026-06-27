import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from '../helpers.jsx'

export const Row = (props: any) => {
  const { gap = '20px', align = 'stretch', children } = props
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <div
      ref={(ref) => connect(drag(ref as any))}
      style={getCommonWrapperStyle(props, {
        display: 'flex',
        flexWrap: 'wrap',
        gap,
        alignItems: align,
        width: '100%',
        minHeight: props.minHeight || 50,
        padding: props.padding || 10,
      })}
    >
      {children}
    </div>
  )
}

Row.craft = {
  displayName: 'Satir',
  props: {
    gap: '20px',
    align: 'stretch',
    padding: '10px',
  },
  rules: {
    canMoveIn: (incomingNodes: any) => incomingNodes.every((node: any) => node.data.displayName === 'Sutun'),
  },
  related: {
    settings: () => {
      const { actions, gap, align, props } = useNode((node: any) => ({
        gap: node.data.props.gap,
        align: node.data.props.align,
        props: node.data.props,
      }))

      return (
        <div style={{ padding: 10 }}>
          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Kolonlar Arasi Bosluk</label>
            <input value={gap} onChange={(e) => actions.setProp((p: any) => { p.gap = e.target.value })} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Dikey Hizalama</label>
            <select value={align} onChange={(e) => actions.setProp((p: any) => { p.align = e.target.value })} style={inputStyle}>
              <option value="stretch">Esnet</option>
              <option value="flex-start">Ust</option>
              <option value="center">Orta</option>
              <option value="flex-end">Alt</option>
            </select>
          </div>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: '#374151',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 13,
}
