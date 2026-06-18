import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function EntryPage() {
  const { isMobilePortrait } = useResponsiveFlags()
  const nav = useNavigate()

  useEffect(() => { document.title = 'PenPOS â€“ GiriÅŸ SeÃ§imi' }, [])

  return (
    <div className={isMobilePortrait ? 'main pageMobile' : 'main'} style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <div style={{ display: 'grid', gap: 12, textAlign: 'center', width: 'min(800px, 100%)' }}>
        <img src="/penpos%20logo.png" alt="PenPOS" style={{ height: 64, margin: '0 auto' }} onError={(e) => { e.currentTarget.src = '/penpos-logo.png' }} />
        <div style={{ color: 'var(--muted)' }}>LÃ¼tfen giriÅŸ yapmak istediÄŸiniz sistemi seÃ§in</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <button type="button" className="card public-touch-card" onClick={() => nav('/login/platform')} style={{ textDecoration: 'none', color: 'inherit', padding: 30, display: 'grid', placeItems: 'center', gap: 15, width: '100%', border: 'none', cursor: 'pointer' }}>
            <div style={{ fontSize: 40 }}>ğŸ› ï¸</div>
            <div style={{ fontWeight: 700 }}>Platform</div>
          </button>
          <button type="button" className="card public-touch-card" onClick={() => nav('/login/restoran')} style={{ textDecoration: 'none', color: 'inherit', padding: 30, display: 'grid', placeItems: 'center', gap: 15, width: '100%', border: 'none', cursor: 'pointer' }}>
            <div style={{ fontSize: 40 }}>ğŸ½ï¸</div>
            <div style={{ fontWeight: 700 }}>Restoran</div>
          </button>
          <button type="button" className="card public-touch-card" onClick={() => nav('/login/kantin')} style={{ textDecoration: 'none', color: 'inherit', padding: 30, display: 'grid', placeItems: 'center', gap: 15, width: '100%', border: 'none', cursor: 'pointer' }}>
            <div style={{ fontSize: 40 }}>ğŸ›’</div>
            <div style={{ fontWeight: 700 }}>MaÄŸaza</div>
          </button>
        </div>
      </div>
    </div>
  )
}
