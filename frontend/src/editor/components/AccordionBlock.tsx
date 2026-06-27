import React, { useState } from 'react'
import { useNode } from '@craftjs/core'

export const AccordionBlock = ({ items }: any) => {
  const {
    connectors: { connect, drag },
  } = useNode()
  const [openIndex, setOpenIndex] = useState<number>(-1)

  return (
    <div ref={(ref) => connect(drag(ref as any))} style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
      {items.map((item: any, i: number) => (
        <div
          key={i}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 'var(--border-radius)',
            marginBottom: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
            style={{
              padding: '14px 16px',
              background: '#f9fafb',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: '600',
              color: 'var(--secondary-color)',
            }}
          >
            <span>{item.q}</span>
            <span style={{ transition: 'transform 0.2s', transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0deg)' }}>v</span>
          </div>
          {openIndex === i ? (
            <div
              style={{
                padding: '14px 16px',
                borderTop: '1px solid #e5e7eb',
                color: 'var(--secondary-color)',
                lineHeight: '1.6',
              }}
            >
              {item.a}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

AccordionBlock.craft = {
  displayName: 'Akordeon (SSS)',
  props: {
    items: [
      { q: 'Soru 1: Nasil siparis verebilirim?', a: 'Online menumuzden kolayca siparis verebilirsiniz.' },
      { q: 'Soru 2: Teslimat suresi ne kadar?', a: 'Ortalama 30-45 dakika icinde teslim ediyoruz.' },
      { q: 'Soru 3: Odeme secenekleri nelerdir?', a: 'Kredi karti, nakit ve online odeme kabul ediyoruz.' },
    ],
  },
  related: {
    settings: () => {
      const { actions, items } = useNode((node: any) => ({ items: node.data.props.items }))
      return (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
            SSS Ogeleri (JSON formatinda)
          </label>
          <textarea
            rows={12}
            value={JSON.stringify(items, null, 2)}
            onChange={(e) => {
              try {
                actions.setProp((p: any) => (p.items = JSON.parse(e.target.value)))
              } catch (error) {}
            }}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
          />
          <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px', padding: '8px', background: '#fef3c7', borderRadius: '4px' }}>
            Format: <code>{`[{"q":"Soru","a":"Cevap"}]`}</code>
          </p>
        </div>
      )
    },
  },
}
