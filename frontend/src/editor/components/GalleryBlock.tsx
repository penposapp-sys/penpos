import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const GalleryBlock = (props: any) => {
  const { images, columns, gap } = props
  const { connectors: { connect, drag } } = useNode()

  return (
    <div
      ref={ref => connect(drag(ref as any))}
      style={getCommonWrapperStyle(props, {
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      })}
    >
      {images.map((img: string, i: number) => (
        <img
          key={i}
          src={img}
          alt={`Galeri ${i + 1}`}
          style={{
            width: '100%',
            aspectRatio: '1',
            objectFit: 'cover',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.03)' }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)' }}
        />
      ))}
    </div>
  )
}

GalleryBlock.craft = {
  displayName: 'Resim Galerisi',
  props: {
    columns: 3,
    gap: 12,
    padding: '30px',
    images: [
      'https://picsum.photos/seed/g1/300',
      'https://picsum.photos/seed/g2/300',
      'https://picsum.photos/seed/g3/300',
      'https://picsum.photos/seed/g4/300',
      'https://picsum.photos/seed/g5/300',
      'https://picsum.photos/seed/g6/300',
    ],
  },
  related: {
    settings: () => {
      const { actions, columns, gap, images, props } = useNode((node: any) => ({
        columns: node.data.props.columns,
        gap: node.data.props.gap,
        images: node.data.props.images,
        props: node.data.props,
      }))
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Sutun Sayisi</label>
            <select
              value={columns}
              onChange={e => actions.setProp((p: any) => { p.columns = parseInt(e.target.value, 10) })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="2">2 Sutun</option>
              <option value="3">3 Sutun</option>
              <option value="4">4 Sutun</option>
              <option value="5">5 Sutun</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
              Bosluk (px): {gap}
            </label>
            <input
              type="range"
              min="0"
              max="40"
              value={gap}
              onChange={e => actions.setProp((p: any) => { p.gap = parseInt(e.target.value, 10) })}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
              Resim URL'leri
            </label>
            <textarea
              rows={8}
              value={images.join('\n')}
              onChange={e => actions.setProp((p: any) => { p.images = e.target.value.split('\n').filter((x) => x.trim()) })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
            />
          </div>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
