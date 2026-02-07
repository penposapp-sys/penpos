import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  useEffect(() => { document.title = 'PenPOS – Giriş Seçimi' }, [])

  return (
    <div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
      <div style={{ display: 'grid', gap: 20, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>PenPOS</h1>
        <div style={{ color: 'var(--muted)', marginBottom: 20 }}>Lütfen giriş yapmak istediğiniz sistemi seçin</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, maxWidth: 800 }}>
          <Link to="/login/platform" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: 30, display: 'grid', placeItems: 'center', gap: 15, transition: 'transform 0.2s' }}>
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
