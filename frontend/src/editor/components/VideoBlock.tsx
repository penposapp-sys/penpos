import React from 'react';
import { useNode } from '@craftjs/core';

export const VideoBlock = ({ url, aspect }: any) => {
  const { connectors: { connect, drag } } = useNode();
  
  let embedUrl = url;
  if (url.includes('youtube.com/watch')) embedUrl = url.replace('watch?v=', 'embed/');
  else if (url.includes('youtu.be/')) embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
  else if (url.includes('vimeo.com/')) embedUrl = url.replace('vimeo.com/', 'player.vimeo.com/video/');

  const heights: any = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%' };

  return (
    <div ref={ref => connect(drag(ref as any))} style={{ padding: '20px 30px' }}>
      <div style={{ 
        position: 'relative', 
        paddingBottom: heights[aspect], 
        height: 0, 
        overflow: 'hidden', 
        borderRadius: 'var(--border-radius)',
        background: '#000'
      }}>
        <iframe 
          src={embedUrl} 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} 
          frameBorder="0" 
          allowFullScreen 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    </div>
  );
};

VideoBlock.craft = {
  displayName: 'Video',
  props: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', aspect: '16:9' },
  related: {
    settings: () => {
      const { actions, url, aspect } = useNode((node: any) => ({ 
        url: node.data.props.url, 
        aspect: node.data.props.aspect 
      }));
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Video URL</label>
            <input 
              value={url} 
              onChange={e => actions.setProp((p: any) => p.url = e.target.value)}
              placeholder="YouTube veya Vimeo linki"
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>En-Boy Oranı</label>
            <select 
              value={aspect} 
              onChange={e => actions.setProp((p: any) => p.aspect = e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="16:9">16:9 (Geniş Ekran)</option>
              <option value="4:3">4:3 (Klasik)</option>
              <option value="1:1">1:1 (Kare)</option>
            </select>
          </div>
        </div>
      );
    }
  }
};