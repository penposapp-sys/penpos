import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from '../helpers.jsx'

export const Column = (props: any) => {
  const { width = '100%', padding = '0px', children } = props
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <div
      ref={(ref) => connect(drag(ref as any))}
      style={getCommonWrapperStyle(props, {
        width,
        padding,
        minHeight: props.minHeight || 50,
        position: 'relative',
        flex: `0 0 ${width}`,
        maxWidth: width,
      })}
    >
      {children || (
        <div
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: 4,
            padding: 20,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 12,
          }}
        >
          Buraya bilesen surukleyin
        </div>
      )}
    </div>
  )
}

Column.craft = {
  displayName: 'Sutun',
  props: {
    width: '100%',
    padding: '0px',
  },
  rules: {
    canDrop: () => true,
    canDrag: () => true,
  },
  related: {
    settings: () => {
      const { actions, width, padding, props } = useNode((node: any) => ({
        width: node.data.props.width,
        padding: node.data.props.padding,
        props: node.data.props,
      }))

      const presets = [
        { label: 'Tam (100%)', value: '100%' },
        { label: 'Yarim (50%)', value: '50%' },
        { label: 'Ucte Bir (33.33%)', value: '33.33%' },
        { label: 'Dortte Bir (25%)', value: '25%' },
        { label: 'Ucte Iki (66.66%)', value: '66.66%' },
        { label: 'Dortte Uc (75%)', value: '75%' },
      ]

      return (
        <div style={{ padding: 10 }}>
          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Genislik</label>
            <select value={width} onChange={(e) => actions.setProp((p: any) => { p.width = e.target.value })} style={inputStyle}>
              {presets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
            <input
              value={width}
              onChange={(e) => actions.setProp((p: any) => { p.width = e.target.value })}
              placeholder="Ozel: 40%, 300px, auto"
              style={{ ...inputStyle, marginTop: 8 }}
            />
          </div>
          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Ic Bosluk (padding)</label>
            <input value={padding} onChange={(e) => actions.setProp((p: any) => { p.padding = e.target.value })} placeholder="0px" style={inputStyle} />
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
