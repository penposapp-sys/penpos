import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { trStatusLabel } from '../i18n/tr.js'
import Modal from '../components/Modal.jsx'

export default function PlatformAdminPaymentRequests() {
  const { isMobilePortrait } = useResponsiveFlags()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api(`/api/platform/billing/requests?status=${encodeURIComponent(status)}`)
      if (!res?.ok) throw new Error(res?.message || 'Talepler yuklenemedi')
      setItems(res?.items || [])
    } catch (err) {
      setError(err.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status])

  const approve = async (r) => {
    try {
      setSaving(true)
      const res = await api(`/api/platform/billing/requests/${r.id}/approve`, { method: 'POST' })
      if (!res?.ok) throw new Error(res?.message || 'Talep onaylanamadi')
      setSaving(false)
      await load()
    } catch (err) {
      setSaving(false)
      setError(err.message)
    }
  }
  const reject = (r) => {
    setRejectTarget(r)
    setDecisionNote('')
    setRejectOpen(true)
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    try {
      setSaving(true)
      const res = await api(`/api/platform/billing/requests/${rejectTarget.id}/reject`, { method: 'POST', body: JSON.stringify({ decisionNote }) })
      if (!res?.ok) throw new Error(res?.message || 'Talep reddedilemedi')
      setSaving(false)
      setRejectOpen(false)
      await load()
    } catch (err) {
      setSaving(false)
      setError(err.message)
    }
  }

  const statusLabel = (s) => trStatusLabel(s)

  const systemLabel = (st) => {
    const t = String(st || '').toLowerCase()
    if (t === 'kantin') return 'KANTİN'
    return 'RESTORAN'
  }

  return (
    <div className="main">
      <div className="actionWrap" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Üyelik Talepleri</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 36 }}>
            <option value="pending">Beklemede</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
            <option value="cancelled">İptal edildi</option>
            <option value="all">Hepsi</option>
          </select>
          <button className="btn btn--compact" type="button" onClick={load} disabled={loading || saving}>{loading ? '...' : 'Yenile'}</button>
        </div>
      </div>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      <div className="card">
        {loading ? 'Yükleniyor...' : (
          items.length === 0 ? (
            <div>Henüz talep yok.</div>
          ) : (
            isMobilePortrait ? (
              <div className="cardList">
                {items.map(r => (
                  <div key={r.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="breakAny" style={{ fontWeight: 800 }}>{r.tenantName || r.tenantId}</div>
                        <div className="breakAny" style={{ color: 'var(--muted)', fontSize: 13 }}>{systemLabel(r.tenantSystemType)} • {r.requestedPlanName || r.requestedPlanId}</div>
                      </div>
                      <span className="page-pill">{statusLabel(r.status)}</span>
                    </div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Tutar</div>
                        <div style={{ fontWeight: 800, textAlign: 'right' }}>{(r.requestedPlanPrice || 0).toLocaleString('tr-TR')} ₺</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Tarih</div>
                        <div style={{ fontWeight: 700, textAlign: 'right' }}>{new Date(r.createdAt).toLocaleString('tr-TR')}</div>
                      </div>
                    </div>
                    <div className="actionWrap" style={{ marginTop: 10 }}>
                      <button className="btn" onClick={() => approve(r)} disabled={saving || r.status !== 'pending'}>Onayla</button>
                      <button className="btn" onClick={() => reject(r)} disabled={saving || r.status !== 'pending'}>Reddet</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Üye</th><th>Sistem</th><th>Paket</th><th>Tutar</th><th>Tarih</th><th>Durum</th><th style={{ width: 220 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr key={r.id}>
                      <td>{r.tenantName || r.tenantId}</td>
                      <td>{systemLabel(r.tenantSystemType)}</td>
                      <td>{r.requestedPlanName || r.requestedPlanId}</td>
                      <td>{(r.requestedPlanPrice || 0).toLocaleString('tr-TR')} ₺</td>
                      <td>{new Date(r.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{statusLabel(r.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" onClick={() => approve(r)} disabled={saving || r.status !== 'pending'}>Onayla</button>
                          <button className="btn" onClick={() => reject(r)} disabled={saving || r.status !== 'pending'}>Reddet</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )
        )}
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Talebi Reddet">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>İstersen açıklama ekleyebilirsin (opsiyonel).</div>
          <textarea className="input" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} rows={4} disabled={saving} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn--compact" type="button" onClick={() => setRejectOpen(false)} disabled={saving}>Vazgeç</button>
            <button className="btn btn--compact btn--danger" type="button" onClick={submitReject} disabled={saving}>{saving ? '...' : 'Reddet'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
