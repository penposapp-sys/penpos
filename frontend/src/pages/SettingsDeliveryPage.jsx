import React from 'react'
import { Link } from 'react-router-dom'

export default function SettingsDeliveryPage() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ borderColor: 'var(--border)' }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Paket Servis</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          Paket sipariş yönetimi Operasyon ekranı altında.
        </div>
        <div style={{ marginTop: 10 }}>
          <Link className="btn btn--full" to="/kermes/app/delivery">Paket Servis’e Git</Link>
        </div>
      </div>
    </div>
  )
}

