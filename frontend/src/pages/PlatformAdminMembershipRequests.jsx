import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminFilterField,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableCard,
} from '../components/AdminListUi.jsx'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Beklemede' },
  { value: 'approved', label: 'Onaylandi' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'cancelled', label: 'Iptal edildi' },
  { value: 'all', label: 'Tumu' },
]

const SYSTEM_OPTIONS = [
  { value: 'all', label: 'Tum Sistemler' },
  { value: 'kermes', label: 'Restoran' },
  { value: 'canteen', label: 'Mağaza' },
]

function getStatusMeta(value) {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'approved') return { label: 'Onaylandi', tone: 'success' }
  if (key === 'rejected') return { label: 'Reddedildi', tone: 'danger' }
  if (key === 'cancelled') return { label: 'Iptal edildi', tone: 'neutral' }
  return { label: 'Beklemede', tone: 'warning' }
}

function getSystemLabel(value) {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'canteen' || key === 'kantin') return 'Mağaza'
  return 'Restoran'
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('tr-TR')
}

export default function PlatformAdminMembershipRequests() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [systemType, setSystemType] = useState('all')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      qs.set('status', status)
      if (systemType !== 'all') qs.set('systemType', systemType)
      const res = await api(`/api/platform/billing/requests?${qs.toString()}`, { portalOverride: 'platform' })
      const nextItems = Array.isArray(res?.items) ? res.items : []
      setItems(nextItems)
      return nextItems
    } catch (err) {
      setError(err.message)
      setItems([])
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [status, systemType])

  const approve = async (item) => {
    try {
      setSaving(true)
      await api(`/api/platform/billing/requests/${item.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: '' }),
        portalOverride: 'platform'
      })
      await load()
      toast.success('Uyelik talebi onaylandi')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openReject = (item) => {
    setRejectTarget(item)
    setDecisionNote('')
    setRejectOpen(true)
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    try {
      setSaving(true)
      await api(`/api/platform/billing/requests/${rejectTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote }),
        portalOverride: 'platform'
      })
      setRejectOpen(false)
      await load()
      toast.success('Uyelik talebi reddedildi')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="main">
      <div className="admin-page">
        <AdminPageHeader title="Uyelik Talepleri" subtitle="Restoran ve mağaza paket taleplerini yönetin." />

        <AdminFilterBar>
          <AdminFilterField label="Durum">
            <select className="input admin-filter-input" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </AdminFilterField>
          <AdminFilterField label="Sistem">
            <select className="input admin-filter-input" value={systemType} onChange={(event) => setSystemType(event.target.value)}>
              {SYSTEM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </AdminFilterField>
          <AdminFilterField label=" ">
            <button className="btn btn--compact" type="button" onClick={load} disabled={loading || saving}>
              {loading ? 'Yukleniyor...' : 'Yenile'}
            </button>
          </AdminFilterField>
        </AdminFilterBar>

        {error ? <div style={{ color: '#dc2626', fontWeight: 700 }}>{error}</div> : null}

        <AdminTableCard>
          {loading ? (
            <div style={{ padding: 22, fontWeight: 700, color: '#64748b' }}>Yukleniyor...</div>
          ) : items.length === 0 ? (
            <AdminEmptyState title="Henuz uyelik talebi yok" description="Yeni gelen paket talepleri burada listelenecek." />
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Uye</th>
                    <th>Sistem</th>
                    <th>Talep Edilen Plan</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                    <th className="admin-actions-cell">Islemler</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const statusMeta = getStatusMeta(item.status)
                    return (
                      <tr key={item.id} className="admin-table-row">
                        <td title={item?.tenant?.name || ''}>
                          <span className="admin-cell-ellipsis">{item?.tenant?.name || 'Isimsiz uye'}</span>
                        </td>
                        <td>
                          <span className="admin-cell-ellipsis">{getSystemLabel(item?.tenant?.systemType)}</span>
                        </td>
                        <td title={item.planName || ''}>
                          <span className="admin-cell-ellipsis">{item.planName || 'Plan yok'}</span>
                        </td>
                        <td>
                          <span className="admin-cell-ellipsis">{formatDateTime(item.createdAt)}</span>
                        </td>
                        <td>
                          <AdminStatusBadge tone={statusMeta.tone}>{statusMeta.label}</AdminStatusBadge>
                        </td>
                        <td className="admin-actions-cell">
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button className="btn btn--compact" type="button" onClick={() => approve(item)} disabled={saving || item.status !== 'pending'}>
                              Onayla
                            </button>
                            <button className="btn btn--compact btn--danger" type="button" onClick={() => openReject(item)} disabled={saving || item.status !== 'pending'}>
                              Reddet
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminTableCard>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Uyelik Talebini Reddet">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Isterseniz red nedeni ekleyebilirsiniz.</div>
          <textarea className="input" rows={4} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} disabled={saving} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn--compact" type="button" onClick={() => setRejectOpen(false)} disabled={saving}>Vazgec</button>
            <button className="btn btn--compact btn--danger" type="button" onClick={submitReject} disabled={saving}>
              {saving ? 'Gonderiliyor...' : 'Reddet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
