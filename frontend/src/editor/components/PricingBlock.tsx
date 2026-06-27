import React from 'react';
import { useNode } from '@craftjs/core';

export const PricingBlock = ({ plans }: any) => {
  const { connectors: { connect, drag } } = useNode();

  return (
    <div ref={ref => connect(drag(ref as any))} style={{ padding: '40px 30px' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${plans.length}, 1fr)`, 
        gap: '20px', 
        maxWidth: '1100px', 
        margin: '0 auto' 
      }}>
        {plans.map((p: any, i: number) => (
          <div 
            key={i} 
            style={{ 
              padding: '30px 25px', 
              borderRadius: 'var(--border-radius)', 
              border: p.featured ? '2px solid var(--primary-color)' : '2px solid #e5e7eb', 
              background: p.featured ? 'var(--primary-color)' : 'white', 
              color: p.featured ? 'white' : 'var(--secondary-color)', 
              position: 'relative',
              boxShadow: p.featured ? '0 10px 30px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            {p.featured && (
              <div style={{ 
                position: 'absolute', 
                top: '-12px', 
                left: '50%', 
                transform: 'translateX(-50%)', 
                background: 'var(--secondary-color)', 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: '12px', 
                fontSize: '11px', 
                fontWeight: '600' 
              }}>
                POPÜLER
              </div>
            )}
            <h3 style={{ fontSize: '1.3rem', margin: '0 0 10px' }}>{p.name}</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '10px 0' }}>
              {p.price}<span style={{ fontSize: '1rem', opacity: 0.7 }}>/{p.period}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0' }}>
              {p.features.map((f: string, j: number) => (
                <li 
                  key={j} 
                  style={{ 
                    padding: '8px 0', 
                    borderBottom: `1px solid ${p.featured ? 'rgba(255,255,255,0.2)' : '#f3f4f6'}` 
                  }}
                >
                  ✓ {f}
                </li>
              ))}
            </ul>
            <button 
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: 'var(--border-radius)', 
                border: p.featured ? 'none' : '2px solid var(--primary-color)', 
                background: p.featured ? 'white' : 'transparent', 
                color: p.featured ? 'var(--primary-color)' : 'var(--primary-color)', 
                fontWeight: '600', 
                cursor: 'pointer',
                fontFamily: 'var(--font-family)'
              }}
            >
              {p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

PricingBlock.craft = {
  displayName: 'Fiyat Tablosu',
  props: { 
    plans: [
      { name: 'Başlangıç', price: '99₺', period: 'ay', features: ['1 Mağaza', '100 Ürün', 'Temel Raporlar'], cta: 'Başla', featured: false },
      { name: 'Pro', price: '299₺', period: 'ay', features: ['5 Mağaza', 'Sınırsız Ürün', 'Gelişmiş Raporlar', 'Öncelikli Destek'], cta: 'Başla', featured: true },
      { name: 'Kurumsal', price: '799₺', period: 'ay', features: ['Sınırsız Mağaza', 'Sınırsız Ürün', 'API Erişimi', '7/24 Destek'], cta: 'İletişime Geç', featured: false }
    ]
  },
  related: {
    settings: () => {
      const { actions, plans } = useNode((node: any) => ({ plans: node.data.props.plans }));
      return (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
            Planlar (JSON)
          </label>
          <textarea 
            rows={14} 
            value={JSON.stringify(plans, null, 2)} 
            onChange={e => { 
              try { 
                actions.setProp((p: any) => p.plans = JSON.parse(e.target.value)); 
              } catch(e) {} 
            }}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
          />
          <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px', padding: '8px', background: '#f3f4f6', borderRadius: '4px' }}>
            Format: <code>{"{"}name, price, period, features:[], cta, featured{"}"}</code>
          </p>
        </div>
      );
    }
  }
};