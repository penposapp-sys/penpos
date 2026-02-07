import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function EntryPage() {
  const { isMobilePortrait } = useResponsiveFlags()
  useEffect(() => { document.title = 'PenPOS – Giriş Seçimi' }, [])
  return (
    <div className={isMobilePortrait ? 'main pageMobile' : 'main'} style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <div style={{ display: 'grid', gap: 12, textAlign: 'center', width: 'min(800px, 100%)' }}>
        <img src="/penpos%20logo.png" alt="PenPOS" style={{ height: 64, margin: '0 auto' }} onError={(e) => { e.currentTarget.src = '/penpos-logo.png' }} />
        <div style={{ color: 'var(--muted)' }}>Lütfen giriş yapmak istediğiniz sistemi seçin</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Link to="/login/platform" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: 30, display: 'grid', placeItems: 'center', gap: 15 }}>
            <div style={{ fontSize: 40 }}>🛠️</div>
            <div style={{ fontWeight: 700 }}>Platform</div>
          </Link>
          <Link to="/login/restoran" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: 30, display: 'grid', placeItems: 'center', gap: 15 }}>
            <div style={{ fontSize: 40 }}>🍽️</div>
            <div style={{ fontWeight: 700 }}>Restoran</div>
          </Link>
          <Link to="/login/kantin" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: 30, display: 'grid', placeItems: 'center', gap: 15 }}>
            <div style={{ fontSize: 40 }}>🛒</div>
            <div style={{ fontWeight: 700 }}>Kantin</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
