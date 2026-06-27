import React from 'react';
import { useNode } from '@craftjs/core';

export const StatsBlock = ({ items }: any) => {
  const { connectors: { connect, drag } } = useNode();

  return (
    <div ref={ref => connect(drag(ref as any))} style={{ padding: '50px 30px', background: 'var(--secondary-color)', color: 'white' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${items.length}, 1fr)`, 
        gap: '30px', 
        maxWidth: '1100px', 
        margin: '0 auto', 
        textAlign: 'center' 
      }}>
        {items.map((item: any, i: number) => (
          <div key={i}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
              {item.value}
            </div>
            <div style={{ fontSize: '1rem', marginTop: '8px', opacity: 0.9 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

StatsBlock.craft = {
  displayName: 'İstatistikler',
  props: { 
    items: [
      { value: '10K+', label: 'Mutlu Müşteri' },
      { value: '500+', label: 'Ürün Çeşidi' },
      { value: '50+', label: 'Şube' },
      { value: '24/7', label: 'Destek' }
    ]
  },
  related: {
    settings: () => {
      const { actions, items } = useNode((node: any) => ({ items: node.data.props.items }));
      return (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
            İstatistikler (JSON)
          </label>
          <textarea 
            rows={10} 
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