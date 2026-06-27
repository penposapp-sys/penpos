import React, { useState } from 'react'
import { useNode } from '@craftjs/core'

export const TabsBlock = ({ tabs }: any) => {
  const {
    connectors: { connect, drag },
  } = useNode()
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div ref={(ref) => connect(drag(ref as any))} style={{ padding: '30px' }}>
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb' }}>
        {tabs.map((t: any, i: number) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            style={{
              padding: '10px 16px',
              background: activeIndex === i ? 'var(--primary-color)' : '#f3f4f6',
              color: activeIndex === i ? 'white' : 'var(--secondary-color)',
              border: 'none',
              borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeIndex === i ? '600' : '400',
            }}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div
        style={{
          padding: '20px',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderRadius: '0 0 var(--border-radius) var(--border-radius)',
          minHeight: '100px',
          color: 'var(--secondary-color)',
          lineHeight: '1.6',
        }}
      >
        {tabs[activeIndex]?.content}
      </div>
    </div>
  )
}

TabsBlock.craft = {
  displayName: 'Sekmeler',
  props: {
    tabs: [
      { title: 'Hakkinda', content: 'Isletmemiz hakkinda bilgiler...' },
      { title: 'Hizmetler', content: 'Sundugumuz hizmetler...' },
      { title: 'Iletisim', content: 'Bize ulasin...' },
    ],
  },
  related: {
    settings: () => {
      const { actions, tabs } = useNode((node: any) => ({ tabs: node.data.props.tabs }))
      return (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
            Sekmeler (JSON)
          </label>
          <textarea
            rows={12}
            value={JSON.stringify(tabs, null, 2)}
            onChange={(e) => {
              try {
                actions.setProp((p: any) => (p.tabs = JSON.parse(e.target.value)))
              } catch (error) {}
            }}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
          />
          <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px', padding: '8px', background: '#f3f4f6', borderRadius: '4px' }}>
            Format: <code>{`[{"title":"Baslik","content":"Icerik"}]`}</code>
          </p>
        </div>
      )
    },
  },
}
