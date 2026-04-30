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
      const res = await api('/api/platform/payments')
      if (!res?.ok) throw new Error(res?.message || 'Talepler yuklenemedi')
      const requests = Array.isArray(res?.requests) ? res.requests : []
      setItems(status === 'all' ? requests : requests.filter((item) => String(item?.status || '') === status))
    } catch (err) {
      setError(err.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status])

  const approve = async (requestItem) => {
    try {
      setSaving(true)
      const res = await api(`/api/platform/payments/${requestItem.id}/approve`, { method: 'PUT' })
      if (!res?.ok) throw new Error(res?.message || 'Talep onaylanamadi')
      setSaving(false)
      await load()
    } catch (err) {
      setSaving(false)
      setError(err.message)
    }
  }

  const reject = (requestItem) => {
    setRejectTarget(requestItem)
    setDecisionNote('')
    setRejectOpen(true)
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    try {
      setSaving(true)
      const res = await api(`/api/platform/payments/${rejectTarget.id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ decisionNote }),
      })
      if (!res?.ok) throw new Error(res?.message || 'Talep reddedilemedi')
      setSaving(false)
      setRejectOpen(false)
      await load()
    } catch (err) {
      setSaving(false)
      setError(err.message)
    }
  }

  const statusLabel = (value) => trStatusLabel(value)

  const systemLabel = (value) => {
    const type = String(value || 'kermes').toLowerCase()
    if (type === 'kantin') return 'KANTIN'
    return 'RESTORAN'
  }

  return (
    <div className="main">
      <div className="actionWrap" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Odeme Talepleri</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 36 }}>
            <option value="pending">Beklemede</option>
            <option value="approved">Onaylandi</option>
            <option value="rejected">Reddedildi</option>
            <option value="all">Hepsi</option>
          </select>
          <button className="btn btn--compact" type="button" onClick={load} disabled={loading || saving}>
            {loading ? '...' : 'Yenile'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}

      <div className="card">
        {loading ? 'Yukleniyor...' : (
          items.length === 0 ? (
            <div>Henuz talep yok.</div>
          ) : (
            isMobilePortrait ? (
              <div className="cardList">
                {items.map((item) => (
                  <div key={item.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="breakAny" style={{ fontWeight: 800 }}>{item.tenantName || item.tenantId}</div>
                        <div className="breakAny" style={{ color: 'var(--muted)', fontSize: 13 }}>
                          {systemLabel(item.systemType)} · {item.planName || item.planId}
                        </div>
                      </div>
                      <span className="page-pill">{statusLabel(item.status)}</span>
                    </div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Tutar</div>
                        <div style={{ fontWeight: 800, textAlign: 'right' }}>{(item.amount || 0).toLocaleString('tr-TR')} ₺</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Tarih</div>
                        <div style={{ fontWeight: 700, textAlign: 'right' }}>{new Date(item.createdAt).toLocaleString('tr-TR')}</div>
                      </div>
                    </div>
                    <div className="actionWrap" style={{ marginTop: 10 }}>
                      <button className="btn" onClick={() => approve(item)} disabled={saving || item.status !== 'pending'}>Onayla</button>
                      <button className="btn" onClick={() => reject(item)} disabled={saving || item.status !== 'pending'}>Reddet</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Uye</th><th>Sistem</th><th>Paket</th><th>Tutar</th><th>Tarih</th><th>Durum</th><th style={{ width: 220 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.tenantName || item.tenantId}</td>
                      <td>{systemLabel(item.systemType)}</td>
                      <td>{item.planName || item.planId}</td>
                      <td>{(item.amount || 0).toLocaleString('tr-TR')} ₺</td>
                      <td>{new Date(item.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{statusLabel(item.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" onClick={() => approve(item)} disabled={saving || item.status !== 'pending'}>Onayla</button>
                          <button className="btn" onClick={() => reject(item)} disabled={saving || item.status !== 'pending'}>Reddet</button>
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
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Istersen aciklama ekleyebilirsin.</div>
          <textarea className="input" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} rows={4} disabled={saving} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn--compact" type="button" onClick={() => setRejectOpen(false)} disabled={saving}>Vazgec</button>
            <button className="btn btn--compact btn--danger" type="button" onClick={submitReject} disabled={saving}>{saving ? '...' : 'Reddet'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
