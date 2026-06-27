import React from 'react';
import { useNode } from '@craftjs/core';

export const TestimonialsBlock = ({ items }: any) => {
  const { connectors: { connect, drag } } = useNode();

  return (
    <div ref={ref => connect(drag(ref as any))} style={{ padding: '40px 30px', background: '#f9fafb' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '20px', 
        maxWidth: '1100px', 
        margin: '0 auto' 
      }}>
        {items.map((item: any, i: number) => (
          <div 
            key={i} 
            style={{ 
              background: 'white', 
              padding: '25px', 
              borderRadius: 'var(--border-radius)', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)' 
            }}
          >
            <div style={{ fontSize: '40px', color: 'var(--primary-color)', lineHeight: '1' }}>"</div>
            <p style={{ margin: '10px 0 20px', color: 'var(--secondary-color)', lineHeight: '1.6' }}>
              {item.text}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src={item.avatar} 
                alt={item.name} 
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: 'var(--secondary-color)' }}>{item.name}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{item.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

TestimonialsBlock.craft = {
  displayName: 'Müşteri Yorumları',
  props: { 
    items: [
      { name: 'Ahmet Y.', role: 'Düzenli Müşteri', text: 'Mükemmel hizmet, kesinlikle tavsiye ederim!', avatar: 'https://picsum.photos/seed/a1/100' },
      { name: 'Ayşe K.', role: 'Yeni Müşteri', text: 'Harika bir deneyim, tekrar geleceğim.', avatar: 'https://picsum.photos/seed/a2/100' },
      { name: 'Mehmet D.', role: 'İş Ortağı', text: 'Kalite ve hizmet bir arada, teşekkürler.', avatar: 'https://picsum.photos/seed/a3/100' }
    ]
  },
  related: {
    settings: () => {
      const { actions, items } = useNode((node: any) => ({ items: node.data.props.items }));
      return (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
            Yorumlar (JSON)
          </label>
          <textarea 
            rows={12} 
            value={JSON.stringify(items, null, 2)} 
            onChange={e => { 
              try { 
                actions.setProp((p: any) => p.items = JSON.parse(e.target.value)); 
              } catch(e) {} 
            }}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
          />
        </div>
      );
    }
  }
};