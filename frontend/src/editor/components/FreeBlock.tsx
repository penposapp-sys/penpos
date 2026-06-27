import React, { useEffect, useState } from 'react'
import { useNode } from '@craftjs/core'
import { Rnd } from 'react-rnd'

export interface FreeBlockProps {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  locked: boolean
  children?: React.ReactNode
}

export const FreeBlock: React.FC<FreeBlockProps> = ({
  x = 0,
  y = 0,
  width = 200,
  height = 100,
  zIndex = 1,
  locked = false,
  children,
}) => {
  const {
    connectors: { connect },
    actions: { setProp },
  } = useNode()

  const [state, setState] = useState({ x, y, width, height })
  const [isSelected, setIsSelected] = useState(false)

  useEffect(() => {
    setState({ x, y, width, height })
  }, [x, y, width, height])

  const snapToGrid = (value: number, gridSize = 8) => Math.round(value / gridSize) * gridSize

  return (
    <Rnd
      position={{ x: state.x, y: state.y }}
      size={{ width: state.width, height: state.height }}
      onDragStop={(_, data) => {
        const nextX = snapToGrid(data.x)
        const nextY = snapToGrid(data.y)
        setState((current) => ({ ...current, x: nextX, y: nextY }))
        setProp((props: any) => {
          props.x = nextX
          props.y = nextY
        })
      }}
      onResizeStop={(_, __, ref, ___, position) => {
        const nextWidth = snapToGrid(parseInt(ref.style.width, 10) || state.width)
        const nextHeight = snapToGrid(parseInt(ref.style.height, 10) || state.height)
        const nextX = snapToGrid(position.x)
        const nextY = snapToGrid(position.y)

        setState({ x: nextX, y: nextY, width: nextWidth, height: nextHeight })
        setProp((props: any) => {
          props.x = nextX
          props.y = nextY
          props.width = nextWidth
          props.height = nextHeight
        })
      }}
      disableDragging={locked}
      enableResizing={
        locked
          ? false
          : {
              top: true,
              right: true,
              bottom: true,
              left: true,
              topRight: true,
              bottomRight: true,
              bottomLeft: true,
              topLeft: true,
            }
      }
      bounds="parent"
      dragGrid={[8, 8]}
      resizeGrid={[8, 8]}
      style={{
        zIndex,
        cursor: locked ? 'default' : 'move',
      }}
      onMouseDown={() => setIsSelected(true)}
    >
      <div
        ref={(ref) => connect(ref as any)}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          outline: isSelected ? '2px solid #3b82f6' : 'none',
          background: 'transparent',
        }}
      >
        {children}

        {isSelected ? (
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: 0,
              display: 'flex',
              gap: 4,
              background: 'white',
              padding: 4,
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 9999,
            }}
          >
            <button
              onClick={(event) => {
                event.stopPropagation()
                setProp((props: any) => {
                  props.zIndex = Math.max(1, (props.zIndex || 1) - 1)
                })
              }}
              style={controlBtnStyle}
              title="Arkaya al"
            >
              v
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                setProp((props: any) => {
                  props.zIndex = (props.zIndex || 1) + 1
                })
              }}
              style={controlBtnStyle}
              title="One al"
            >
              ^
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                setProp((props: any) => {
                  props.locked = !props.locked
                })
              }}
              style={controlBtnStyle}
              title={locked ? 'Kilidi ac' : 'Kilitle'}
            >
              {locked ? 'LOCK' : 'MOVE'}
            </button>
          </div>
        ) : null}
      </div>
    </Rnd>
  )
}

FreeBlock.craft = {
  displayName: 'Serbest Blok',
  props: {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    zIndex: 1,
    locked: false,
  },
  related: {
    settings: () => {
      const { actions, x, y, width, height, zIndex, locked } = useNode((node: any) => ({
        x: node.data.props.x,
        y: node.data.props.y,
        width: node.data.props.width,
        height: node.data.props.height,
        zIndex: node.data.props.zIndex,
        locked: node.data.props.locked,
      }))

      return (
        <div style={{ padding: 10 }}>
          <h4 style={{ fontSize: 12, margin: '0 0 10px', color: '#6b7280' }}>Konum ve Boyut</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 15 }}>
            <div>
              <label style={labelStyle}>X (px)</label>
              <input type="number" value={x} onChange={(e) => actions.setProp((p: any) => (p.x = parseInt(e.target.value, 10) || 0))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Y (px)</label>
              <input type="number" value={y} onChange={(e) => actions.setProp((p: any) => (p.y = parseInt(e.target.value, 10) || 0))} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 15 }}>
            <div>
              <label style={labelStyle}>Genislik (px)</label>
              <input type="number" value={width} onChange={(e) => actions.setProp((p: any) => (p.width = parseInt(e.target.value, 10) || 200))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Yukseklik (px)</label>
              <input type="number" value={height} onChange={(e) => actions.setProp((p: any) => (p.height = parseInt(e.target.value, 10) || 100))} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Z-Index</label>
            <input type="number" value={zIndex} onChange={(e) => actions.setProp((p: any) => (p.zIndex = parseInt(e.target.value, 10) || 1))} style={inputStyle} />
          </div>

          <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
            <input type="checkbox" checked={locked} onChange={(e) => actions.setProp((p: any) => (p.locked = e.target.checked))} />
            Konumu kilitle
          </label>
        </div>
      )
    },
  },
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 4,
  color: '#374151',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 6,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 12,
}

const controlBtnStyle: React.CSSProperties = {
  width: 32,
  height: 28,
  border: '1px solid #e5e7eb',
  background: 'white',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
