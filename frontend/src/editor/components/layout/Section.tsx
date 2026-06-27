import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from '../helpers.jsx'

export interface SectionProps {
  padding?: string
  background?: string
  backgroundType?: 'color' | 'gradient' | 'image'
  backgroundGradient?: string
  backgroundImage?: string
  minHeight?: string
  children?: React.ReactNode
}

export const Section: React.FC<SectionProps> = (props) => {
  const {
    padding = '60px 20px',
    background = '#ffffff',
    backgroundType = 'color',
    backgroundGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundImage = '',
    minHeight = '100px',
    children,
  } = props

  const {
    connectors: { connect, drag },
  } = useNode()

  const bgStyle =
    backgroundType === 'color'
      ? { background }
      : backgroundType === 'gradient'
        ? { background: backgroundGradient }
        : { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }

  return (
    <div
      ref={(ref) => connect(drag(ref as any))}
      style={getCommonWrapperStyle(props, {
        padding,
        ...bgStyle,
        width: '100%',
        position: 'relative',
        minHeight,
      })}
    >
      {children}
    </div>
  )
}

function SectionSettings() {
  const { actions, padding, background, backgroundType, backgroundGradient, backgroundImage, props } = useNode((node: any) => ({
    padding: node.data.props.padding,
    background: node.data.props.background,
    backgroundType: node.data.props.backgroundType,
    backgroundGradient: node.data.props.backgroundGradient,
    backgroundImage: node.data.props.backgroundImage,
    props: node.data.props,
  }))

  return (
    <div style={{ padding: 10 }}>
      <h4 style={{ fontSize: 12, margin: '0 0 10px', color: '#6b7280' }}>Bolum Ayarlari</h4>

      <div style={{ marginBottom: 15 }}>
        <label style={labelStyle}>Ic Bosluk (padding)</label>
        <input value={padding} onChange={(e) => actions.setProp((p: any) => { p.padding = e.target.value })} placeholder="60px 20px" style={inputStyle} />
        <p style={hintStyle}>Ornek: 60px 20px</p>
      </div>

      <div style={{ marginBottom: 15 }}>
        <label style={labelStyle}>Arka Plan Tipi</label>
        <select value={backgroundType} onChange={(e) => actions.setProp((p: any) => { p.backgroundType = e.target.value })} style={inputStyle}>
          <option value="color">Duz Renk</option>
          <option value="gradient">Gradient</option>
          <option value="image">Resim</option>
        </select>
      </div>

      {backgroundType === 'color' ? (
        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Arka Plan Rengi</label>
          <input type="color" value={background} onChange={(e) => actions.setProp((p: any) => { p.background = e.target.value })} style={{ ...inputStyle, height: 40 }} />
        </div>
      ) : null}

      {backgroundType === 'gradient' ? (
        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Gradient CSS</label>
          <input value={backgroundGradient} onChange={(e) => actions.setProp((p: any) => { p.backgroundGradient = e.target.value })} style={inputStyle} />
        </div>
      ) : null}

      {backgroundType === 'image' ? (
        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Resim URL</label>
          <input value={backgroundImage} onChange={(e) => actions.setProp((p: any) => { p.backgroundImage = e.target.value })} style={inputStyle} />
        </div>
      ) : null}

      <CommonStyleSettings props={props} setProp={actions.setProp} />
    </div>
  )
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

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  marginTop: 4,
}

Section.craft = {
  displayName: 'Bolum',
  props: {
    padding: '60px 20px',
    background: '#ffffff',
    backgroundType: 'color',
    backgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundImage: '',
    minHeight: '100px',
  },
  rules: {
    canDrop: () => true,
    canDrag: () => true,
    canMoveIn: (incomingNodes: any) => incomingNodes.every((node: any) => node.data.displayName === 'Satir'),
  },
  related: {
    settings: SectionSettings,
  },
}
