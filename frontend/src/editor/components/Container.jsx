import React from 'react'
import { useNode } from '@craftjs/core'

export function Container({ children, background = 'transparent', padding = 0 }) {
  const {
    connectors: { connect },
    childCount,
  } = useNode((node) => ({
    childCount: node.data.nodes.length,
  }))

  return (
    <div
      ref={(ref) => {
        if (ref) connect(ref)
      }}
      style={{
        minHeight: 520,
        background,
        padding,
        width: '100%',
        position: 'relative',
        border: childCount === 0 ? '2px dashed #93c5fd' : '2px solid transparent',
        borderRadius: 18,
      }}
    >
      {childCount === 0 ? (
        <div
          style={{
            minHeight: 220,
            display: 'grid',
            placeItems: 'center',
            color: '#64748b',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            padding: 24,
          }}
        >
          Bilesenleri buraya surukleyin veya soldaki kartlara tiklayin.
        </div>
      ) : null}
      {children}
    </div>
  )
}

Container.craft = {
  displayName: 'Sayfa Konteyneri',
  props: {
    background: 'transparent',
    padding: 0,
  },
}
