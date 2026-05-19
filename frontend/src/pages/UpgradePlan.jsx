import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import { getSubscriptionStatus } from '../lib/subscription.js'
import {
  formatPlanBadge,
  formatPlanDate,
  getPlanDisplayName,
  getRemainingPlanMeta,
} from '../lib/planPresentation.js'

const statusLabel = (value) => {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'pending') return 'Beklemede'
  if (key === 'approved') return 'Onaylandi'
  if (key === 'rejected') return 'Reddedildi'
  if (key === 'cancelled') return 'Iptal edildi'
  return String(value || '')
}

export default function UpgradePlan() {
  const { tenantCtx, refresh } = useAuth()
  const [plans, setPlans] = useState([])
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const paymentPending = !!tenantCtx?.tenant?.paymentPending

  const loadPlans = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/api/tenant/billing/plans')
      setPlans(Array.isArray(res?.items) ? res.items : [])
    } catch (err) {
      setError(err.message)
      setPlans([])
    } finally {
      setLoading(false)
    }
  }

  const loadRequests = async () => {
    setRequestsLoading(true)
    try {
      const res = await api('/api/tenant/billing/requests')
      setRequests(Array.isArray(res?.items) ? res.items : [])
    } catch (err) {
      setError(err.message)
      setRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
    loadRequests()
  }, [])

  const openRequest = (plan) => {
    setSelectedPlan(plan)
    setSuccessMsg('')
    setRequestOpen(true)
  }

  const submitRequest = async (event) => {
    event.preventDefault()
    setRequestLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      await api('/api/tenant/billing/requests', {
        method: 'POST',
        body: JSON.stringify({ requestedPlanId: selectedPlan.id })
      })
      setRequestOpen(false)
      setSuccessMsg('Uyelik talebiniz alindi. Onay bekleniyor.')
      await Promise.all([loadRequests(), refresh()])
    } catch (err) {
      setError(err.message)
    } finally {
      setRequestLoading(false)
    }
  }

  const subscriptionStatus = getSubscriptionStatus(tenantCtx)
  const isSubscriptionActive = subscriptionStatus === 'active' || subscriptionStatus === 'trial'
  const currentPlan = tenantCtx?.tenant?.currentPlan || tenantCtx?.tenant?.plan || null
  const expiredPlan = tenantCtx?.tenant?.expiredPlan || null
  const infoPlan = currentPlan || expiredPlan || null
  const currentPlanId = currentPlan?.id || null
  const planMeta = formatPlanBadge(infoPlan || {})
  const remainingMeta = getRemainingPlanMeta(infoPlan || {})
  const planName = getPlanDisplayName(infoPlan)
  const latestRequest = Array.isArray(requests) && requests.length > 0 ? requests[0] : null

  return (
    <div className="main" style={{ display: 'grid', gap: 12 }}>
      {(infoPlan || subscriptionStatus === 'expired') && (
        <div className="card" style={{ borderColor: subscriptionStatus === 'expired' ? '#dc2626' : '#f59e0b' }}>
          {paymentPending ? (
            <div style={{ fontWeight: 700, color: '#f59e0b' }}>Uyelik talebiniz onay bekliyor.</div>
          ) : subscriptionStatus === 'expired' ? (
            <>
              <div style={{ fontWeight: 700, color: '#dc2626' }}>Paket sureniz doldu. Sistemi kullanmaya devam etmek icin planinizi yukseltin.</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Bu surede sadece abonelik ve hesap islemleri acik kalir.</div>
            </>
          ) : (
            <div style={{ fontWeight: 700, color: '#f59e0b' }}>Uyelik surenizin bitmesine {remainingMeta.days || 0} gun kaldi.</div>
          )}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Mevcut Plan</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Abonelik, plan ve limit bilgileri.</div>
          </div>
          {!!planName && (
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', background: '#f9fafb', fontWeight: 800 }}>
              {planMeta.label}
            </span>
          )}
        </div>

        {!planName ? (
          <div style={{ color: 'var(--muted)' }}>Plan bilgisi bulunamadi</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{planName}</div>
            <div style={{ display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
              <div>Baslangic: {formatPlanDate(infoPlan?.startsAt) || '-'}</div>
              <div>Bitis: {formatPlanDate(infoPlan?.endsAt) || '-'}</div>
              <div>Kalan sure: {remainingMeta.label}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Uyelik Talepleri</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Platform onayina giden paket talepleri.</div>
          </div>
          <button className="btn btn--compact" type="button" onClick={loadRequests} disabled={requestsLoading || requestLoading}>
            {requestsLoading ? '...' : 'Yenile'}
          </button>
        </div>

        {!latestRequest ? (
          <div style={{ color: 'var(--muted)' }}>Henuz talep yok.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 700 }}>{latestRequest.requestedPlanName || '-'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Durum: {statusLabel(latestRequest.status)}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Tarih: {latestRequest.createdAt ? new Date(latestRequest.createdAt).toLocaleString('tr-TR') : '-'}</div>
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 0 }}>Paket Yukselt</h3>
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      {successMsg && <div style={{ color: '#22c55e' }}>{successMsg}</div>}

      <div>
        {loading ? 'Yukleniyor...' : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {plans.map((plan) => (
              <div key={plan.id} className="card" style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{plan.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiyat (aylik): {plan.price?.toLocaleString('tr-TR')} ₺</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Kullanim Limitleri: Urun {plan.limits?.products ?? '-'} • Masa {plan.limits?.tables ?? '-'} • Personel {plan.limits?.staff ?? '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Ozellikler: Raporlar {plan.features?.reports ? 'Var' : 'Yok'} • Mutfak {plan.features?.kitchen ? 'Var' : 'Yok'}
                </div>
                {isSubscriptionActive && currentPlanId && currentPlanId === plan.id ? (
                  <button className="btn" disabled>Mevcut Paket</button>
                ) : paymentPending ? (
                  <button className="btn" disabled>Onay Bekleniyor</button>
                ) : (
                  <button className="btn" onClick={() => openRequest(plan)}>
                    {isSubscriptionActive ? 'Paketi Degistir' : 'Paketi Yukselt'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Yeni Uyelik Talebi">
        <form onSubmit={submitRequest} style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Secilen Paket: {selectedPlan?.name || ''}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tutar: {(selectedPlan?.price || 0).toLocaleString('tr-TR')} ₺ / ay</div>
          <div>Bu talep platform uyelik taleplerine gonderilir ve onaylandiginda paketiniz aktif edilir.</div>
          <button className="btn" disabled={requestLoading}>{requestLoading ? 'Gonderiliyor...' : 'Uyelik Talebi Olustur'}</button>
        </form>
      </Modal>
    </div>
  )
}
