import React from 'react';
import { useNode } from '@craftjs/core';

const ICONS: any = {
  instagram: 'M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.3 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .3-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.3-1-.4-2.2-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.3 2.2-.4 1.2-.1 1.6-.1 4.8-.1zM12 0C8.7 0 8.3 0 7.1.1 5.8.1 5 .3 4.2.6c-.8.3-1.5.7-2.2 1.4C1.3 2.7.9 3.4.6 4.2.3 5 .1 5.8.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.2 2.1.5 2.9.3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.6.5 2.9.5 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.1-.2 2.9-.5.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.6.5-2.9.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.2-2.1-.5-2.9-.3-.8-.7-1.5-1.4-2.2-.7-.7-1.4-1.1-2.2-1.4-.8-.3-1.6-.5-2.9-.5C15.7 0 15.3 0 12 0zm0 5.8c-3.4 0-6.2 2.8-6.2 6.2s2.8 6.2 6.2 6.2 6.2-2.8 6.2-6.2-2.8-6.2-6.2-6.2zM12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm6.4-11.8c-.8 0-1.4.6-1.4 1.4s.6 1.4 1.4 1.4 1.4-.6 1.4-1.4-.6-1.4-1.4-1.4z',
  facebook: 'M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 10.9 10.1 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4C19.6 22.9 24 18 24 12z',
  twitter: 'M23.6 4.6c-.8.4-1.7.6-2.7.8 1-.6 1.7-1.5 2.1-2.6-.9.5-1.9.9-3 1.1-.9-.9-2.1-1.5-3.4-1.5-2.6 0-4.7 2.1-4.7 4.7 0 .4 0 .7.1 1.1C8.4 8 4.8 6.1 2.3 3.3c-.4.7-.6 1.5-.6 2.4 0 1.6.8 3.1 2.1 3.9-.8 0-1.5-.2-2.1-.5 0 2.3 1.6 4.2 3.8 4.6-.4.1-.8.2-1.2.2-.3 0-.6 0-.9-.1.6 1.9 2.4 3.3 4.5 3.4-1.7 1.3-3.8 2.1-6.1 2.1-.4 0-.8 0-1.2-.1 2.2 1.4 4.8 2.2 7.5 2.2 9 0 14-7.5 14-14v-.6c1-.7 1.8-1.6 2.5-2.6z',
  whatsapp: 'M20.5 3.5C18.3 1.3 15.3 0 12 0 5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.7.9 3.7 1.4 5.8 1.4 6.6 0 12-5.4 12-12 0-3.3-1.3-6.3-3.5-8.5zM12 22c-1.9 0-3.7-.5-5.3-1.4l-.4-.2-3.7 1 1-3.6-.2-.4c-1-1.6-1.4-3.4-1.4-5.3C2 6.6 6.6 2 12 2s10 4.6 10 10-4.6 10-10 10zm5.5-7.5c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.1.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4z',
  youtube: 'M23.5 6.2c-.3-1-1-1.8-2-2C19.6 3.7 12 3.7 12 3.7s-7.6 0-9.5.5c-1 .3-1.8 1-2 2C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1 1 1.8 2 2 1.9.5 9.5.5 9.5.5s7.6 0 9.5-.5c1-.3 1.8-1 2-2 .5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z',
  tiktok: 'M12.5 2v12.5c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3c.3 0 .6 0 .9.1V8.3c-.3 0-.6-.1-.9-.1C6.1 8.2 3.5 10.8 3.5 14s2.6 5.8 5.8 5.8 5.8-2.6 5.8-5.8V7.3c1.2.9 2.7 1.4 4.4 1.4V5.5c-2.8 0-5-2.2-5-5V2h-2z',
  linkedin: 'M20.5 2h-17C2.6 2 2 2.6 2 3.5v17c0 .9.6 1.5 1.5 1.5h17c.9 0 1.5-.6 1.5-1.5v-17c0-.9-.6-1.5-1.5-1.5zM8 19H5V9h3v10zM6.5 7.3c-1 0-1.7-.8-1.7-1.7s.8-1.7 1.7-1.7c1 0 1.7.8 1.7 1.7s-.7 1.7-1.7 1.7zM19 19h-3v-5.3c0-3.1-3-2.9-3 0V19h-3V9h3v1.8c1.4-2.6 6-2.8 6 1.7V19z'
};

export const SocialBlock = ({ links, size }: any) => {
  const { connectors: { connect, drag } } = useNode();

  return (
    <div ref={ref => connect(drag(ref as any))} style={{ padding: '20px 30px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
      {links.map((l: any, i: number) => ICONS[l.platform] && (
        <a 
          key={i} 
          href={l.url} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'inline-block', transition: 'transform 0.2s' }}
          onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.15)')}
          onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--primary-color)">
            <path d={ICONS[l.platform]}/>
          </svg>
        </a>
      ))}
    </div>
  );
};

SocialBlock.craft = {
  displayName: 'Sosyal Medya',
  props: { 
    size: 32, 
    links: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'facebook', url: 'https://facebook.com' },
      { platform: 'twitter', url: 'https://twitter.com' },
      { platform: 'whatsapp', url: 'https://wa.me/' },
      { platform: 'youtube', url: 'https://youtube.com' },
      { platform: 'tiktok', url: 'https://tiktok.com' }
    ]
  },
  related: {
    settings: () => {
      const { actions, size, links } = useNode((node: any) => ({ 
        size: node.data.props.size, 
        links: node.data.props.links 
      }));
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
              İkon Boyutu (px): {size}
            </label>
            <input 
              type="range" 
              min="20" 
              max="64" 
              value={size} 
              onChange={e => actions.setProp((p: any) => p.size = parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
              Platformlar ve Linkler (JSON)
            </label>
            <textarea 
              rows={10} 
              value={JSON.stringify(links, null, 2)} 
              onChange={e => { 
                try { 
                  actions.setProp((p: any) => p.links = JSON.parse(e.target.value)); 
                } catch(e) {} 
              }}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
            />
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px' }}>
              Platformlar: instagram, facebook, twitter, whatsapp, youtube, tiktok, linkedin
            </p>
          </div>
        </div>
      );
    }
  }
};