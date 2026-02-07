import React from 'react'
import { Link } from 'react-router-dom'

export default function CanteenHome() {
  const links = [
    { to: '/canteen/branches', title: 'Şubeler', desc: 'Kantin şubelerini yönet' },
    { to: '/canteen/catalog', title: 'Katalog', desc: 'Kategori ve ürünler' },
    { to: '/canteen/staff', title: 'Personel', desc: 'Kantin personeli' },
    { to: '/canteen/settings', title: 'Ayarlar', desc: 'Şube ayarları' }
  ]
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Kantin Modülü</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Bu alan yalnızca `/api/canteen/*` endpointlerini kullanır.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {links.map(l => (
          <Link key={l.to} to={l.to} className="card" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{l.title}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

