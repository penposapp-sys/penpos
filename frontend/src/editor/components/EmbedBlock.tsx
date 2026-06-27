import React from 'react';
import { useNode } from '@craftjs/core';

export const EmbedBlock = ({ html }: any) => {
  const { connectors: { connect, drag } } = useNode();
  
  return (
    <div 
      ref={ref => connect(drag(ref as any))} 
      style={{ padding: '20px 30px' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

EmbedBlock.craft = {
  displayName: 'HTML Gömme',
  props: { html: '<div style="padding:20px;background:#f3f4f6;text-align:center">Özel HTML içeriği buraya</div>' },
  related: {
    settings: () => {
      const { actions, html } = useNode((node: any) => ({ html: node.data.props.html }));
      return (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
            HTML Kodu
          </label>
          <textarea 
            rows={12} 
            value={html} 
            onChange={e => actions.setProp((p: any) => p.html = e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #d1d5db', 
              borderRadius: '4px', 
              fontFamily: 'monospace', 
              fontSize: '12px',
              resize: 'vertical'
            }}
          />
          <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '5px', padding: '8px', background: '#fef2f2', borderRadius: '4px' }}>
            ⚠️ Dikkat: XSS güvenlik riskine karşı backend tarafında sanitize işlemi yapın!
          </p>
        </div>
      );
    }
  }
};