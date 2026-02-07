import React, { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient.js'

export default function CanteenBranchSettingsPanel() {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  const [payment, setPayment] = useState(null)

  const load = async () => {
    setLoading(true)
    const s = await api('/api/canteen/settings', { silent: true })
    const p = await api('/api/canteen/payment-settings', { silent: true })
    setSettings(s?.settings || null)
    setPayment(p?.settings || null)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const updateSettings = async (patch) => {
    const res = await api('/api/canteen/settings', { method: 'PUT', data: patch })
    if (res?.ok) setSettings(res.settings)
  }

  const updatePayment = async (patch) => {
    const res = await api('/api/canteen/payment-settings', { method: 'PUT', data: patch })
    if (res?.ok) setPayment(res.settings)
  }

  if (!settings || !payment) {
    return (
      <div style={{ color: 'var(--muted)' }}>
        Ayar okunamadı.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Kantin Ayarları</div>
        <button className="btn" type="button" onClick={load} disabled={loading} style={{ padding: '0 10px', height: 34 }}>{loading ? '...' : 'Yenile'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!payment.cashEnabled} onChange={(e) => updatePayment({ cashEnabled: e.target.checked })} />
          <div>
            <div style={{ fontWeight: 700 }}>Nakit</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Nakit ödeme aktif</div>
          </div>
        </label>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!payment.cardEnabled} onChange={(e) => updatePayment({ cardEnabled: e.target.checked })} />
          <div>
            <div style={{ fontWeight: 700 }}>Kart</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Kart ödeme aktif</div>
          </div>
        </label>
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={!!payment.ibanEnabled} onChange={(e) => updatePayment({ ibanEnabled: e.target.checked })} />
          <div>
            <div style={{ fontWeight: 700 }}>IBAN</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>IBAN ödeme aktif</div>
          </div>
        </label>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>IBAN Metni</div>
          <input className="input" value={String(payment.ibanText || '')} onChange={(e) => setPayment(s => ({ ...s, ibanText: e.target.value }))} onBlur={() => updatePayment({ ibanText: payment.ibanText })} />
        </label>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Varsayılan KDV</div>
          <input className="input" value={String(settings.defaultVatRate ?? 0)} onChange={(e) => setSettings(s => ({ ...s, defaultVatRate: e.target.value }))} onBlur={() => updateSettings({ defaultVatRate: Number(settings.defaultVatRate || 0) })} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Üst Metin</div>
          <input className="input" value={String(settings.receiptHeader || '')} onChange={(e) => setSettings(s => ({ ...s, receiptHeader: e.target.value }))} onBlur={() => updateSettings({ receiptHeader: settings.receiptHeader })} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Alt Metin</div>
          <input className="input" value={String(settings.receiptFooter || '')} onChange={(e) => setSettings(s => ({ ...s, receiptFooter: e.target.value }))} onBlur={() => updateSettings({ receiptFooter: settings.receiptFooter })} />
        </label>
      </div>
    </div>
  )
}
