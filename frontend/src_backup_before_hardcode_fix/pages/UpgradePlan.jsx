import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import { useNavigate } from 'react-router-dom'

export default function UpgradePlan() {
  const { tenantCtx, refresh, user } = useAuth()
  const nav = useNavigate()
  const [plans, setPlans] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [payLoading, setPayLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const paymentPending = !!tenantCtx?.tenant?.paymentPending

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const { plans } = await api('/api/tenant/plans')
        setPlans(plans)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const openPay = (p) => {
    setSelectedPlan(p)
    setSuccessMsg('')
    setPayOpen(true)
  }

  const submitPay = async (e) => {
    e.preventDefault()
    setPayLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      await api('/api/payments/request', { method: 'POST', body: JSON.stringify({ planId: selectedPlan.id }) })
      setPayOpen(false)
      setSuccessMsg('Ödeme talebiniz alındı. Onay bekleniyor.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setPayLoading(false)
    }
  }

  const currentPlanId = tenantCtx?.tenant?.plan?.id || null
  const plan = tenantCtx?.tenant?.plan || null
  const planStatus = String(plan?.status || '')
  const daysLeft = Math.max(0, Number(plan?.daysLeft || 0) || 0)

  return (
    <div className="main" style={{ display: 'grid', gap: 12 }}>
      {plan && (
        <div className="card" style={{ borderColor: planStatus === 'expired' ? '#dc2626' : '#f59e0b' }}>
          {paymentPending ? (
            <div style={{ fontWeight: 700, color: '#f59e0b' }}>Ödeme talebiniz onay bekliyor.</div>
          ) : planStatus === 'expired' ? (
            <>
              <div style={{ fontWeight: 700, color: '#dc2626' }}>Üyelik süreniz sona erdi.</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Üyelik yenilemeden yeni ekleme yapamazsınız.</div>
            </>
          ) : (
            <div style={{ fontWeight: 700, color: '#f59e0b' }}>Üyelik sürenizin bitmesine {daysLeft} gün kaldı.</div>
          )}
        </div>
      )}

      <h3 style={{ marginTop: 0 }}>Paket Yükselt</h3>
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      {successMsg && <div style={{ color: '#22c55e' }}>{successMsg}</div>}
      <div>
        {loading ? 'Yükleniyor...' : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {plans.map(p => (
              <div key={p.id} className="card" style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiyat (aylık): {p.price?.toLocaleString('tr-TR')} ₺</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Kullanım Limitleri: Ürün {p.limits?.products ?? '-'} • Masa {p.limits?.tables ?? '-'} • Personel {p.limits?.staff ?? '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Özellikler: Raporlar {p.features?.reports ? 'Var' : 'Yok'} • Mutfak {p.features?.kitchen ? 'Var' : 'Yok'}
                </div>
                {currentPlanId && currentPlanId === p.id ? (
                  <button className="btn" disabled>Mevcut Paket</button>
                ) : paymentPending ? (
                  <button className="btn" disabled>Onay Bekleniyor</button>
                ) : (
                  <button className="btn" onClick={() => openPay(p)}>Havale ile Satın Al</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Havale ile Satın Alma Talebi">
        <form onSubmit={submitPay} style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Seçilen Paket: {selectedPlan?.name || ''}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tutar: {(selectedPlan?.price || 0).toLocaleString('tr-TR')} ₺ / ay</div>
          <div>
            Havale ile ödeme yapmak için aşağıdaki IBAN’a ödeme yapınız. Ödeme onaylandığında paketiniz otomatik olarak aktif edilecektir.
          </div>
          <div className="card" style={{ display: 'grid', gap: 6 }}>
            <div>Alıcı: PenPOS Yazılım</div>
            <div>IBAN: TR00 0000 0000 0000 0000 0000 00</div>
            <div>Açıklama: {user?.name || 'Üye'} - {selectedPlan?.name || 'Paket'}</div>
          </div>
          <button className="btn" disabled={payLoading}>{payLoading ? 'Gönderiliyor...' : 'Ödeme Talebi Oluştur'}</button>
        </form>
      </Modal>
    </div>
  )
}
