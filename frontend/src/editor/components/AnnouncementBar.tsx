import React from 'react';
import { useNode } from '@craftjs/core';

export const AnnouncementBar = ({ text, bgColor, textColor, link }: any) => {
  const { connectors: { connect, drag } } = useNode();

  const content = (
    <div 
      ref={ref => connect(drag(ref as any))} 
      style={{ 
        padding: '12px 30px', 
        background: bgColor, 
        color: textColor, 
        textAlign: 'center', 
        fontSize: '14px', 
        fontWeight: '500',
        fontFamily: 'var(--font-family)'
      }}
    >
      {text}
    </div>
  );

  return link ? <a href={link} style={{ textDecoration: 'none' }}>{content}</a> : content;
};

AnnouncementBar.craft = {
  displayName: 'Duyuru Çubuğu',
  props: { 
    text: '🎉 Büyük indirim! Tüm ürünlerde %50 fırsatı', 
    bgColor: '#fef3c7', 
    textColor: '#92400e',
    link: ''
  },
  related: {
    settings: () => {
      const { actions, text, bgColor, textColor, link } = useNode((node: any) => ({ 
        text: node.data.props.text, 
        bgColor: node.data.props.bgColor, 
        textColor: node.data.props.textColor,
        link: node.data.props.link
      }));
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Metin</label>
            <input 
              value={text} 
              onChange={e => actions.setProp((p: any) => p.text = e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Link (isteğe bağlı)</label>
            <input 
              value={link} 
              onChange={e => actions.setProp((p: any) => p.link = e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Arka Plan Rengi</label>
            <input 
              type="color" 
              value={bgColor} 
              onChange={e => actions.setProp((p: any) => p.bgColor = e.target.value)}
              style={{ width: '100%', height: '40px', cursor: 'pointer' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Yazı Rengi</label>
            <input 
              type="color" 
              value={textColor} 
              onChange={e => actions.setProp((p: any) => p.textColor = e.target.value)}
              style={{ width: '100%', height: '40px', cursor: 'pointer' }}
            />
          </div>
        </div>
      );
    }
  }
};