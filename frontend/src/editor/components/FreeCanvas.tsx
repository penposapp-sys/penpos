import React from 'react'
import { useNode } from '@craftjs/core'

export const FreeCanvas = ({
  children,
  background = '#ffffff',
  width = 1200,
  height = 800,
}: any) => {
  const {
    connectors: { connect },
  } = useNode()

  return (
    <div
      ref={(ref) => connect(ref as any)}
      style={{
        position: 'relative',
        width: `${width}px`,
        minHeight: `${height}px`,
        background,
        margin: '0 auto',
        boxShadow: '0 0 20px rgba(0,0,0,0.1)',
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        overflow: 'hidden',
        borderRadius: '16px',
      }}
    >
      {children}
    </div>
  )
}

FreeCanvas.craft = {
  displayName: 'Serbest Kanvas',
  props: {
    background: '#ffffff',
    width: 1200,
    height: 800,
  },
  rules: {
    canMoveIn: () => true,
  },
  related: {
    settings: () => {
      const { actions, background, width, height } = useNode((node: any) => ({
        background: node.data.props.background,
        width: node.data.props.width,
        height: node.data.props.height,
      }))

      return (
        <div style={{ padding: 10 }}>
          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Arka Plan</label>
            <input type="color" value={background} onChange={(e) => actions.setProp((p: any) => (p.background = e.target.value))} style={{ ...inputStyle, height: 40 }} />
          </div>
          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Kanvas Genisligi (px)</label>
            <input type="number" value={width} onChange={(e) => actions.setProp((p: any) => (p.width = parseInt(e.target.value, 10) || 1200))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Minimum Yukseklik (px)</label>
            <input type="number" value={height} onChange={(e) => actions.setProp((p: any) => (p.height = parseInt(e.target.value, 10) || 800))} style={inputStyle} />
          </div>
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
