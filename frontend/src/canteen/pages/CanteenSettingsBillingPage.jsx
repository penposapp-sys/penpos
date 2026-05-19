import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'
import { isSubscriptionExpired } from '../../lib/subscription.js'
import {
  formatPlanBadge,
  formatPlanDate,
  getPlanDisplayName,
  getRemainingPlanMeta,
  resolvePlanType,
} from '../../lib/planPresentation.js'

const statusLabel = (s) => {
  const t = String(s || '').toLowerCase()
  if (t === 'pending') return 'Beklemede'
  if (t === 'approved') return 'Onaylandi'
  if (t === 'rejected') return 'Reddedildi'
  if (t === 'cancelled') return 'Iptal edildi'
  return String(s || '')
}

const statusColor = (s) => {
  const t = String(s || '').toLowerCase()
  if (t === 'pending') return { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }
  if (t === 'approved') return { bg: '#ecfdf5', border: '#bbf7d0', text: '#166534' }
  if (t === 'rejected') return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }
  if (t === 'cancelled') return { bg: '#f3f4f6', border: '#e5e7eb', text: '#374151' }
  return { bg: '#f3f4f6', border: '#e5e7eb', text: '#374151' }
}

const toLocal = (d) => {
  if (!d) return ''
  try { return new Date(d).toLocaleString('tr-TR') } catch { return String(d || '') }
}

const normalizeLimits = (raw) => {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
  if (!obj) return []
  const labelMap = {
    products: 'Ürün',
    product: 'Ürün',
    tables: 'Masa',
    table: 'Masa',
    staff: 'Personel',
    users: 'Kullanıcı',
    branches: 'Şube',
    devices: 'Cihaz'
  }
  return Object.entries(obj)
    .map(([k, v]) => [labelMap[String(k || '').trim().toLowerCase()] || String(k || ''), v])
    .filter(([k]) => !!k)
}

export default function CanteenSettingsBillingPage() {
  const { me, tenantCtx } = useOutletContext()
  const expired = isSubscriptionExpired(tenantCtx)
  const perms = Array.isArray(me?.permissions) ? me.permissions : []
  const canView = me?.role === 'tenant_admin' || perms.includes('canteen_settings_manage') || perms.includes('canteen_billing_view')
  const canManage = me?.role === 'tenant_admin' || perms.includes('canteen_settings_manage') || perms.includes('canteen_billing_manage')

  const [planLoading, setPlanLoading] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planError, setPlanError] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState('')
  const [plans, setPlans] = useState([])

  const [createOpen, setCreateOpen] = useState(false)
  const [requestedPlanId, setRequestedPlanId] = useState('')
  const [note, setNote] = useState('')
  const [limitUsers, setLimitUsers] = useState('')
  const [limitBranches, setLimitBranches] = useState('')
  const [limitDevices, setLimitDevices] = useState('')
  const [saving, setSaving] = useState(false)

  const requestablePlans = useMemo(() => {
    return (plans || []).map((p) => ({ key: String(p.id || ''), label: String(p.name || ''), price: Number(p.price || 0) }))
  }, [plans])

  const loadPlan = async (options = {}) => {
    const background = options?.background === true
    if (!background) setPlanLoading(true)
    if (!background) setPlanError('')
    try {
      const ctx = await api('/api/tenant/context', { silent: true, portalOverride: 'canteen' })
      const nextPlan = ctx?.tenant?.currentPlan || ctx?.tenant?.plan || ctx?.tenant?.expiredPlan || null
      if (!ctx?.tenant) setPlanError('Plan bilgisi bulunamadi')
      setPlan(nextPlan)
    } catch (err) {
      setPlan(null)
      setPlanError(err?.message || 'Plan bilgisi bulunamadi')
    } finally {
      if (!background) setPlanLoading(false)
    }
  }

  const loadRequests = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    const res = await api('/api/canteen/billing/requests', { silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Uyelik talepleri alinamadi')
      setItems([])
      if (!background) setLoading(false)
      return
    }
    setItems(Array.isArray(res?.items) ? res.items : [])
    if (!background) setLoading(false)
  }

  const loadPlans = async () => {
    setPlansLoading(true)
    setPlansError('')
    const res = await api('/api/canteen/billing/plans', { silent: true })
    if (!res?.ok) {
      setPlansError(res?.message || 'Planlar alinamadi')
      setPlans([])
      setPlansLoading(false)
      return
    }
    const list = (Array.isArray(res?.items) ? res.items : []).filter((item) => resolvePlanType(item) === 'canteen')
    setPlans(list)
    if (!requestedPlanId && list.length > 0) setRequestedPlanId(String(list[0].id || ''))
    setPlansLoading(false)
  }

  useEffect(() => {
    if (!canView) return
    loadPlan()
    loadRequests()
  }, [canView])

  const openCreate = () => {
    if (!canManage) return
    if ((plans || []).length === 0) loadPlans()
    const firstId = (plans || [])[0]?.id ? String(plans[0].id) : ''
    setRequestedPlanId(firstId)
    setNote('')
    setLimitUsers('')
    setLimitBranches('')
    setLimitDevices('')
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!canManage) return
    const planId = String(requestedPlanId || '').trim()
    if (!planId) {
      setError('Plan secimi gerekli')
      return
    }
    const limits = {}
    const u = Number(String(limitUsers || '').replace(',', '.'))
    const b = Number(String(limitBranches || '').replace(',', '.'))
    const d = Number(String(limitDevices || '').replace(',', '.'))
    if (Number.isFinite(u) && u > 0) limits.users = u
    if (Number.isFinite(b) && b > 0) limits.branches = b
    if (Number.isFinite(d) && d > 0) limits.devices = d
    const payload = {
      requestedPlanId: planId,
      requestedLimits: Object.keys(limits).length > 0 ? limits : undefined,
      note: String(note || '').trim()
    }
    setSaving(true)
    const res = await api('/api/canteen/billing/requests', { method: 'POST', data: payload, silent: true })
    setSaving(false)
    if (!res?.ok) {
      setError(res?.message || 'Talep olusturulamadi')
      return
    }
    setCreateOpen(false)
    await loadRequests()
  }

  const cancel = async (id) => {
    if (!canManage) return
    const rid = String(id || '').trim()
    if (!rid) return
    setSaving(true)
    const res = await api(`/api/canteen/billing/requests/${encodeURIComponent(rid)}/cancel`, { method: 'POST', silent: true })
    setSaving(false)
    if (!res?.ok) {
      setError(res?.message || 'Talep iptal edilemedi')
      return
    }
    await loadRequests()
  }

  if (!canView) return <div className="card">403 - Bu sayfaya yetkin yok</div>

  const planLimits = normalizeLimits(plan?.limits)
  const planMeta = formatPlanBadge(plan || {})
  const remainingMeta = getRemainingPlanMeta(plan || {})
  const planName = getPlanDisplayName(plan)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {expired && (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          Paket sureniz doldu. Sistemi kullanmaya devam etmek icin planinizi yukseltin.
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Mevcut Plan</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Abonelik, plan ve limit bilgileri.</div>
          </div>
          <button className="btn btn--compact" type="button" onClick={loadPlan} disabled={planLoading || saving}>{planLoading ? '...' : 'Yenile'}</button>
        </div>

        {planError && <div style={{ color: 'var(--muted)' }}>{planError}</div>}

        {!planLoading && !planName && !planError && <div style={{ color: 'var(--muted)' }}>Plan bilgisi bulunamadi</div>}

        {!!planName && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{planName}</div>
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', background: '#f9fafb', fontWeight: 800 }}>
                {planMeta.label}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
              <div>Baslangic: {formatPlanDate(plan?.startsAt) || '-'}</div>
              <div>Bitis: {formatPlanDate(plan?.endsAt) || '-'}</div>
              <div>Kalan sure: {remainingMeta.label}</div>
            </div>

            {planLimits.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {planLimits.slice(0, 8).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', background: '#f9fafb' }}>
                    {k}: {String(v)}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Limit bilgisi bulunamadi</div>
            )}
          </div>
        )}
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Uyelik Talepleri</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Yukseltme ve limit artirma talepleri.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn--compact" type="button" onClick={loadRequests} disabled={loading || saving}>{loading ? '...' : 'Yenile'}</button>
            {canManage && <button className="btn btn--compact btn--primary" type="button" onClick={openCreate} disabled={saving}>Yeni Talep</button>}
          </div>
        </div>

        {!loading && items.length === 0 && <div style={{ color: 'var(--muted)' }}>Henüz talep yok.</div>}

        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((it) => {
            const st = statusColor(it.status)
            const isPending = String(it.status || '') === 'pending'
            return (
              <div key={it.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>{it.requestedPlanName || '-'}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: `1px solid ${st.border}`, background: st.bg, color: st.text, fontWeight: 800 }}>
                      {statusLabel(it.status)}
                    </span>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{toLocal(it.createdAt)}</div>
                  </div>
                </div>

                {Array.isArray(normalizeLimits(it.requestedLimits)) && normalizeLimits(it.requestedLimits).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {normalizeLimits(it.requestedLimits).slice(0, 8).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', background: '#f9fafb' }}>
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}

                {!!String(it.note || '').trim() && (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }} className="breakAny">Not: {String(it.note || '').trim()}</div>
                )}

                {canManage && isPending && (
                  <div>
                    <button className="btn btn--danger btn--compact" type="button" onClick={() => cancel(it.id)} disabled={saving}>Iptal Et</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Uyelik Talebi">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Paket</div>
            <select className="input" value={requestedPlanId} onChange={(e) => setRequestedPlanId(e.target.value)} style={{ height: 38 }} disabled={saving || plansLoading}>
              <option value="">Seciniz</option>
              {requestablePlans.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            {!!plansError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{plansError}</div>}
            {plansLoading && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Planlar yukleniyor...</div>}
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanici limiti</div>
              <input className="input" value={limitUsers} onChange={(e) => setLimitUsers(e.target.value)} placeholder="orn: 10" disabled={saving} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sube limiti</div>
              <input className="input" value={limitBranches} onChange={(e) => setLimitBranches(e.target.value)} placeholder="orn: 3" disabled={saving} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Cihaz/Kasa limiti</div>
              <input className="input" value={limitDevices} onChange={(e) => setLimitDevices(e.target.value)} placeholder="orn: 2" disabled={saving} />
            </label>
          </div>

          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
            <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="orn: 2 kasa daha eklemek istiyoruz" rows={3} disabled={saving} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn--compact" type="button" onClick={() => setCreateOpen(false)} disabled={saving}>Vazgec</button>
            <button className="btn btn--compact btn--primary" type="button" onClick={submitCreate} disabled={saving || !requestedPlanId}>{saving ? '...' : 'Gonder'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
