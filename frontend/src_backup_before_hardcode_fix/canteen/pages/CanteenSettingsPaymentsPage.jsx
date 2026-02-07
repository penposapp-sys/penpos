import React, { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient.js'

export default function CanteenSettingsPaymentsPage() {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    const p = await api('/api/canteen/payment-settings', { silent: true })
    setSettings(p?.settings || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const update = async (patch) => {
    setError('')
    const res = await api('/api/canteen/payment-settings', { method: 'PUT', data: patch, silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Güncellenemedi')
      return
    }
    setSettings(res.settings || null)
  }

  if (!settings) return <div className="card">Yükleniyor...</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ödeme Seçenekleri</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nakit/POS/Banka/Cari aç-kapat.</div>
        </div>
        <button className="btn" type="button" onClick={load} disabled={loading} style={{ padding: '0 10px', height: 34 }}>{loading ? '...' : 'Yenile'}</button>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!settings.cashEnabled} onChange={(e) => update({ cashEnabled: e.target.checked })} />
          <div>
            <div style={{ fontWeight: 700 }}>Nakit</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Nakit ödeme aktif</div>
          </div>
        </label>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!(settings.posEnabled ?? settings.cardEnabled)} onChange={(e) => update({ posEnabled: e.target.checked })} />
          <div>
            <div style={{ fontWeight: 700 }}>POS</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>POS ödeme aktif</div>
          </div>
        </label>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!(settings.bankEnabled ?? settings.ibanEnabled)} onChange={(e) => update({ bankEnabled: e.target.checked })} />
          <div>
            <div style={{ fontWeight: 700 }}>Banka</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Banka ödeme aktif</div>
          </div>
        </label>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!(settings.accountEnabled ?? true)} onChange={(e) => update({ accountEnabled: e.target.checked })} />
          <div>
            <div style={{ fontWeight: 700 }}>Cari</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Veresiye aktif</div>
          </div>
        </label>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Banka/IBAN Metni</div>
          <input
            className="input"
            value={String(settings.bankText ?? settings.ibanText ?? '')}
            onChange={(e) => setSettings(s => ({ ...s, bankText: e.target.value, ibanText: e.target.value }))}
            onBlur={() => update({ bankText: settings.bankText ?? settings.ibanText ?? '' })}
          />
        </label>
      </div>
    </div>
  )
}

