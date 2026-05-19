import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function SettingsDeliveryPage() {
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadCustomers = async (nextQuery = query) => {
    setLoading(true)
    try {
      const res = await api(`/api/settings/delivery-customers?q=${encodeURIComponent(nextQuery || '')}&limit=50`, { silent: true })
      const nextCustomers = Array.isArray(res?.customers) ? res.customers : []
      setCustomers(nextCustomers)
      if (!selectedId && nextCustomers[0]?.id) setSelectedId(String(nextCustomers[0].id))
      if (selectedId && !nextCustomers.some((customer) => String(customer.id) === String(selectedId))) {
        setSelectedId(String(nextCustomers[0]?.id || ''))
      }
    } catch (err) {
      toast.error(err?.message || 'Paket musterileri yuklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers('')
  }, [])

  useEffect(() => {
    if (String(query || '').trim() === '') return
    const timer = setTimeout(() => {
      loadCustomers(query)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    const loadDetail = async () => {
      setDetailLoading(true)
      try {
        const res = await api(`/api/settings/delivery-customers/${encodeURIComponent(selectedId)}`, { silent: true })
        setDetail({
          customer: res?.customer || null,
          orders: Array.isArray(res?.orders) ? res.orders : []
        })
      } catch (err) {
        toast.error(err?.message || 'Musteri detayi yuklenemedi')
      } finally {
        setDetailLoading(false)
      }
    }
    loadDetail()
  }, [selectedId])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ borderColor: 'var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Paket Servis Musterileri</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            Paket siparislerinde kayitli kisi bilgileri burada tutulur. Isim veya telefonla arayip eski siparislerini gorebilirsin.
          </div>
        </div>
        <Link className="btn" to="/kermes/app/delivery">Paket Servise Git</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait || isTablet ? 'minmax(0, 1fr)' : '320px minmax(0, 1fr)', gap: 12 }}>
        <div className="card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <input className="input" placeholder="Isim veya telefon ara" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div style={{ display: 'grid', gap: 8 }}>
            {loading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Yukleniyor...</div>}
            {!loading && customers.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kayitli musteri yok.</div>}
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="btn"
                onClick={() => setSelectedId(String(customer.id))}
                style={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  background: String(selectedId) === String(customer.id) ? 'var(--app-surface-2, var(--app-surface-soft))' : 'var(--app-surface)',
                  color: 'var(--app-text)',
                  borderColor: String(selectedId) === String(customer.id) ? 'var(--theme-accent, #2563eb)' : 'var(--app-border, var(--border))'
                }}
              >
                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ fontWeight: 700 }}>{customer.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{customer.phone || '-'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{customer.orderCount || 0} siparis</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          {!selectedId && <div style={{ color: 'var(--muted)' }}>Detay icin musteri sec.</div>}
          {selectedId && detailLoading && <div style={{ color: 'var(--muted)' }}>Detay yukleniyor...</div>}
          {selectedId && !detailLoading && detail?.customer && (
            <>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{detail.customer.name}</div>
                <div style={{ color: 'var(--muted)' }}>{detail.customer.phone || '-'}</div>
                <div style={{ color: 'var(--muted)' }}>{detail.customer.address || '-'}</div>
                {detail.customer.note ? <div style={{ color: '#f59e0b' }}>Not: {detail.customer.note}</div> : null}
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 800 }}>Eski Paket Siparisleri</div>
                {(detail.orders || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Gecmis siparis yok.</div>}
                {(detail.orders || []).map((order) => (
                  <div key={order.id} className="card" style={{ borderColor: 'var(--border)', padding: 10, display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{order.orderNo ? `Siparis ${order.orderNo}` : order.id.slice(-6)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{order.createdAt ? new Date(order.createdAt).toLocaleString('tr-TR') : '-'}</div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Durum: {order.deliveryStatus || '-'}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Odeme: {order.paymentStatus || '-'}</div>
                    <div style={{ fontWeight: 700 }}>{Number(order.total || 0).toFixed(2)} TL</div>
                    {order.deliveryNote ? <div style={{ fontSize: 13 }}>Not: {order.deliveryNote}</div> : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
