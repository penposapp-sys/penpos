import React from 'react'
import CanteenBranchSettingsPanel from '../components/CanteenBranchSettingsPanel.jsx'

export default function CanteenSettingsPage() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ayarlar</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kantin ayarları tenant bazlıdır ve `/api/canteen/settings` ile `/api/canteen/payment-settings` üzerinden yönetilir.</div>
        </div>
      </div>
      <CanteenBranchSettingsPanel />
    </div>
  )
}
