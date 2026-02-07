import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  useEffect(() => { document.title = 'PenPOS – Sayfa Bulunamadı' }, [])
  return (
    <div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>Sayfa Bulunamadı</h3>
        <div style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 16 }}>
          İstediğiniz sayfa bulunamadı veya kaldırılmış olabilir.
        </div>
        <Link to="/" className="btn">Ana Sayfaya Dön</Link>
      </div>
    </div>
  )
}
