import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { pickInitialPaymentMethod } from '../lib/paymentMethods.js'

const deliveredHourPresets = [
  { label: '24s', value: 24 },
  { label: '48s', value: 48 },
  { label: '7g', value: 168 }
]

const statusColors = {
  cancel_pending: '#dc2626',
  approval_pending: '#f97316',
  pending: '#fbbf24',
  accepted: '#3b82f6',
  preparing: '#8b5cf6',
  ready: '#10b981',
  delivered: '#22c55e',
  cancelled: '#ef4444'
}

const statusLabels = {
  cancel_pending: 'Iptal Onayi Bekliyor',
  approval_pending: 'Onay Bekliyor',
  pending: 'Bekliyor',
  accepted: 'Onaylandi',
  preparing: 'Hazirlaniyor',
  ready: 'Hazir',
  delivered: 'Teslim Edildi',
  cancelled: 'Iptal'
}

const emptyCreateForm = {
  customerId: '',
  customerName: '',
  phone: '',
  address: '',
  note: '',
  deliveryPaymentStatus: 'pay_on_delivery',
  deliveryPaymentMethod: ''
}

function getOrderId(order) {
  return order?._id || order?.id || order?.orderId || null
}

function normalizeOrder(order) {
  const id = getOrderId(order)
  return id ? { ...order, id } : order
}

function computeUiStatus(order) {
  const current = order || {}
  if (String(current?.orderChannel || '') === 'online' && String(current?.cancelRequestStatus || '') === 'pending') return 'cancel_pending'
  if (String(current?.orderChannel || '') === 'online' && String(current?.approvalStatus || '') === 'pending') return 'approval_pending'
  if (String(current.status || '') === 'cancelled' || String(current.deliveryStatus || '') === 'cancelled') return 'cancelled'
  if (current.deliveredAt || String(current.status || '') === 'delivered' || String(current.deliveryStatus || '') === 'delivered') return 'delivered'
  const items = Array.isArray(current.items) ? current.items : []
  if (items.length === 0) return 'pending'
  if (items.some((item) => item?.status === 'completed')) return 'ready'
  if (items.some((item) => item?.status === 'sent' || item?.status === 'preparing')) return 'preparing'
  if (items.some((item) => item?.status === 'open')) return 'pending'
  return 'pending'
}

function formatDeliveredTime(order) {
  const value = order?.deliveredAt || order?.deliveryAt || null
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return ''
  }
}

export default function DeliveryOrdersPage() {
  const { user, allowedBranchIds } = useAuth()
  const nav = useNavigate()
  const hasPerm = (permission) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(permission)
  const canManageDelivery = hasPerm('manage_delivery')

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('active')
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [deliveredOnlyLastHours, setDeliveredOnlyLastHours] = useState(24)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createOrderError, setCreateOrderError] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false)
  const [payMethods, setPayMethods] = useState([])
  const [approvingId, setApprovingId] = useState('')

  const loadOrders = async (nextTab = tab, opts = {}) => {
    const nextPage = opts.page ?? 1
    const append = opts.append === true
    setLoading(true)
    try {
      if (!Array.isArray(allowedBranchIds)) {
        setOrders([])
        setTotalCount(0)
        return
      }

      const status = nextTab === 'delivered' ? 'delivered' : 'active'
      const params = new URLSearchParams()
      params.set('status', status)
      params.set('limit', '50')
      params.set('page', String(nextPage))
      if (status === 'delivered' && deliveredOnlyLastHours > 0) {
        params.set('onlyLastHours', String(deliveredOnlyLastHours))
      }

      const branchQuery = buildBranchQueryParams(allowedBranchIds)
      if (!branchQuery?.params || branchQuery.ids.length === 0) {
        setOrders([])
        setTotalCount(0)
        return
      }

      for (const [key, value] of params.entries()) {
        branchQuery.params.set(key, value)
      }

      const res = await api(`/api/pos/delivery/orders?${branchQuery.params.toString()}`, {
        skipBranchHeader: true,
        suppressBranchModal: true
      })

      const nextOrders = (Array.isArray(res?.orders) ? res.orders : []).map(normalizeOrder)
      setTotalCount(Number(res?.total || 0))
      setOrders((prev) => append ? [...prev, ...nextOrders] : nextOrders)
      setPage(nextPage)
    } catch (err) {
      toast.error(err?.message || 'Siparisler yuklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders(tab, { page: 1, append: false })
  }, [tab, deliveredOnlyLastHours, allowedBranchIds])

  useEffect(() => {
    const loadPaymentSettings = async () => {
      const selectedBranchId = (() => {
        try {
          return String(localStorage.getItem('selectedBranchId') || '').trim()
        } catch {
          return ''
        }
      })()

      if (!selectedBranchId) {
        setPayMethods([])
        return
      }

      try {
        const res = await api('/api/tenant/payment-settings', { silent: true, suppressBranchModal: true })
        if (res?.success === false) {
          setPayMethods([])
          return
        }
        const methods = Array.isArray(res?.methods) ? res.methods.filter((method) => method.isEnabled) : []
        setPayMethods(methods)
        setCreateForm((prev) => ({
          ...prev,
          deliveryPaymentMethod: prev.deliveryPaymentMethod || pickInitialPaymentMethod(methods, '')
        }))
      } catch {
        setPayMethods([])
      }
    }

    loadPaymentSettings()
  }, [])

  useEffect(() => {
    if (!createOpen) {
      setCustomerSuggestions([])
      setCustomerLookupLoading(false)
      return
    }
    const query = String(createForm.phone || createForm.customerName || '').trim()
    if (!query) {
      setCustomerSuggestions([])
      setCustomerLookupLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setCustomerLookupLoading(true)
      try {
        const res = await api(`/api/pos/delivery/customers/search?q=${encodeURIComponent(query)}&limit=8`, { silent: true, suppressBranchModal: true })
        setCustomerSuggestions(Array.isArray(res?.customers) ? res.customers : [])
      } catch {
        setCustomerSuggestions([])
      } finally {
        setCustomerLookupLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [createOpen, createForm.customerName, createForm.phone])

  const createOrder = async () => {
    setCreateOrderError('')
    const customerId = String(createForm.customerId || '').trim()
    const customerName = String(createForm.customerName || '').trim()
    const phone = String(createForm.phone || '').trim()
    const address = String(createForm.address || '').trim()
    const note = String(createForm.note || '').trim()
    const deliveryPaymentStatus = String(createForm.deliveryPaymentStatus || '').trim() || 'unknown'
    const deliveryPaymentMethod = String(createForm.deliveryPaymentMethod || '').trim()

    if (!customerName) {
      toast.error('Musteri adi zorunlu')
      return
    }

    try {
      const res = await api('/api/pos/delivery/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          customerName,
          phone,
          address,
          note,
          deliveryPaymentStatus,
          deliveryPaymentMethod
        }),
        silent: true
      })

      if (res?.success === false && res?.status === 403) {
        if (res?.code === 'missing_branch') {
          const message = res?.message || 'Sube secimi gerekli.'
          setCreateOrderError(message)
          toast.error(message)
          return
        }
        toast.error(res?.message || 'Bu islem icin yetkiniz yok')
        return
      }

      const fresh = res?.data?.order ?? res?.order ?? null
      if (!fresh) {
        toast.error('Siparis olusturulamadi')
        return
      }

      const normalized = normalizeOrder(fresh)
      setOrders((prev) => [normalized, ...prev])
      setTotalCount((prev) => prev + 1)
      setCreateOpen(false)
      setCreateForm({
        ...emptyCreateForm,
        deliveryPaymentMethod: pickInitialPaymentMethod(payMethods, '')
      })
      setCustomerSuggestions([])
      nav(`/kermes/app/delivery/${getOrderId(normalized)}`)
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Sunucu hatasi. Tekrar deneyin.')
    }
  }

  const applySuggestedCustomer = (customer) => {
    if (!customer) return
    setCreateForm((prev) => ({
      ...prev,
      customerId: String(customer.id || ''),
      customerName: String(customer.name || ''),
      phone: String(customer.phone || ''),
      address: String(customer.address || ''),
      note: String(customer.note || prev.note || '')
    }))
    setCustomerSuggestions([])
  }

  const approveOnlineOrder = async (order) => {
    const id = String(getOrderId(order) || '').trim()
    if (!id) return
    if (!canManageDelivery) {
      toast.error('Bu islem icin yetkiniz yok')
      return
    }

    setApprovingId(id)
    try {
      const res = await api(`/api/pos/package-orders/${id}/approve-online`, {
        method: 'POST',
        silent: true
      })
      if (res?.success === false) {
        toast.error(res?.message || 'Siparis onaylanamadi')
        return
      }

      const fresh = normalizeOrder(res?.order || res?.data?.order || null)
      if (fresh) {
        setOrders((prev) => prev.map((item) => (String(getOrderId(item) || '') === id ? { ...item, ...fresh } : item)))
      }
      toast.success('Siparis onaylandi ve hazirlanacaklara gonderildi')
    } catch (err) {
      toast.error(err?.message || 'Siparis onaylanamadi')
    } finally {
      setApprovingId('')
    }
  }

  const approveCancelRequest = async (order) => {
    const id = String(getOrderId(order) || '').trim()
    if (!id) return
    if (!canManageDelivery) {
      toast.error('Bu islem icin yetkiniz yok')
      return
    }
    setApprovingId(id)
    try {
      const res = await api(`/api/pos/package-orders/${id}/approve-cancel-request`, {
        method: 'POST',
        silent: true
      })
      if (res?.success === false) {
        toast.error(res?.message || 'Iptal talebi onaylanamadi')
        return
      }
      const fresh = normalizeOrder(res?.order || res?.data?.order || null)
      if (fresh) {
        setOrders((prev) => prev.map((item) => (String(getOrderId(item) || '') === id ? { ...item, ...fresh } : item)))
      }
      toast.success('Iptal talebi onaylandi')
    } catch (err) {
      toast.error(err?.message || 'Iptal talebi onaylanamadi')
    } finally {
      setApprovingId('')
    }
  }

  return (
    <div className="delivery-page-shell scrollbar-hidden">
      <div className="delivery-page-header">
        <div>
          <h1 className="delivery-page-title">Paket Siparisler</h1>
          <div className="delivery-page-subtitle">{totalCount || 0} siparis</div>
        </div>
        {canManageDelivery && (
          <button
            className="btn"
            onClick={() => {
              setTab('active')
              setCreateOrderError('')
              setCreateOpen(true)
            }}
          >
            Yeni Paket Siparisi
          </button>
        )}
      </div>

      <div className="delivery-filter-bar">
        <div className="delivery-filter-group">
          <button className="btn btn--toggle" onClick={() => setTab('active')} aria-pressed={tab === 'active'}>
            Aktif Siparisler
          </button>
          <button className="btn btn--toggle" onClick={() => setTab('delivered')} aria-pressed={tab === 'delivered'}>
            Teslim Edilenler
          </button>
        </div>

        {tab === 'delivered' && (
          <div className="delivery-filter-group delivery-filter-group--wrap">
            <span className="delivery-filter-note">
              Varsayilan: son teslim edilenler ({Math.min(50, totalCount || 0)} / {totalCount || 0})
            </span>
            {deliveredHourPresets.map((preset) => (
              <button
                key={preset.value}
                className="btn btn--toggle"
                onClick={() => setDeliveredOnlyLastHours(preset.value)}
                disabled={loading}
                aria-pressed={deliveredOnlyLastHours === preset.value}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="delivery-orders-grid">
        {orders.map((order, idx) => {
          const id = getOrderId(order) || order.id || `order-${idx}`
          const total = Number(order?.netTotal ?? order?.totals?.netTotal ?? order?.totals?.grandTotal ?? order?.total ?? order?.totals?.total ?? 0)
          const paid = (() => {
            const amount = Number(order?.paidTotal ?? order?.totals?.paidTotal)
            if (Number.isFinite(amount)) return amount
            const payments = Array.isArray(order?.payments) ? order.payments : []
            return payments.reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0)
          })()
          const balance = Math.max(0, Number(order?.balanceDue ?? order?.totals?.balanceDue ?? (total - paid)))
          const status = computeUiStatus(order)
          const deliveredAt = formatDeliveredTime(order)
          const createdAt = (() => {
            try {
              return new Date(order?.createdAt || order?.updatedAt || Date.now()).toLocaleString('tr-TR')
            } catch {
              return '-'
            }
          })()

          return (
            <button
              key={id}
              type="button"
              className="delivery-order-card"
              onClick={() => {
                const targetId = getOrderId(order) || order.id
                if (!targetId) return
                nav(`/kermes/app/delivery/${targetId}`)
              }}
            >
              <div className="delivery-card-top">
                <div>
                  <strong>{order?.customerName || 'Musteri'}</strong>
                  {order?.orderNo ? <div className="delivery-card-order-no">Siparis {order.orderNo}</div> : null}
                  {String(order?.orderChannel || '') === 'online' ? <div className="delivery-card-order-no">Online Siparis</div> : null}
                </div>
                <span className="page-pill" style={{ color: statusColors[status] }}>{statusLabels[status]}</span>
              </div>

              <div className="delivery-card-info">
                <span>Telefon: {order?.customerPhone || '-'}</span>
                <span>{tab === 'delivered' ? 'Tutar' : 'Kalan'}: {(tab === 'delivered' ? total : balance).toFixed(2)} TL</span>
                <span>Odenen: {paid.toFixed(2)} TL</span>
                <span>Adres: {order?.customerAddress || '-'}</span>
                {tab === 'delivered' && deliveredAt ? <span>Teslim: {deliveredAt}</span> : null}
              </div>

              <div className="delivery-card-footer">
                <span>{createdAt}</span>
                {status === 'approval_pending' && canManageDelivery && (
                  <button
                    type="button"
                    className="btn"
                    disabled={approvingId === String(id)}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      approveOnlineOrder(order)
                    }}
                  >
                    {approvingId === String(id) ? 'Onaylaniyor...' : 'Onayla'}
                  </button>
                )}
                {status === 'cancel_pending' && canManageDelivery && (
                  <button
                    type="button"
                    className="btn"
                    disabled={approvingId === String(id)}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      approveCancelRequest(order)
                    }}
                  >
                    {approvingId === String(id) ? 'Onaylaniyor...' : 'Iptal Onayla'}
                  </button>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {!loading && orders.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          Gosterilecek paket siparisi yok.
        </div>
      )}

      {tab === 'delivered' && orders.length < totalCount && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="btn" onClick={() => loadOrders('delivered', { page: page + 1, append: true })} disabled={loading}>
            Daha fazla yukle
          </button>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Paket Siparisi">
        <div style={{ display: 'grid', gap: 10 }}>
          {!!createOrderError && (
            <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
              <div style={{ fontWeight: 700, color: '#b91c1c' }}>Sube secimi gerekli</div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>{createOrderError}</div>
            </div>
          )}
          <label>Ad <input className="input" value={createForm.customerName} onChange={(e) => setCreateForm({ ...createForm, customerId: '', customerName: e.target.value })} /></label>
          <label>Tel <input className="input" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, customerId: '', phone: e.target.value })} /></label>
          {(customerLookupLoading || customerSuggestions.length > 0) && (
            <div className="card" style={{ display: 'grid', gap: 8, padding: 8 }}>
              {customerLookupLoading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Musteriler aranıyor...</div>}
              {customerSuggestions.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="btn"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => applySuggestedCustomer(customer)}
                >
                  <div style={{ display: 'grid', textAlign: 'left' }}>
                    <strong>{customer.name}</strong>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{customer.phone || '-'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <label>Adres <textarea className="input" value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} /></label>
          <label>Not <input className="input" value={createForm.note} onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} /></label>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Odeme durumu</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--toggle" aria-pressed={createForm.deliveryPaymentStatus === 'already_paid'} onClick={() => setCreateForm({ ...createForm, deliveryPaymentStatus: 'already_paid' })}>Odemesi alindi</button>
              <button type="button" className="btn btn--toggle" aria-pressed={createForm.deliveryPaymentStatus === 'pay_on_delivery'} onClick={() => setCreateForm({ ...createForm, deliveryPaymentStatus: 'pay_on_delivery', deliveryPaymentMethod: createForm.deliveryPaymentMethod || pickInitialPaymentMethod(payMethods, '') })}>Kapida odeme</button>
            </div>
            {createForm.deliveryPaymentStatus === 'pay_on_delivery' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {payMethods.map((method) => {
                  const methodKey = String(method?.key || method?.id || '')
                  const active = String(createForm.deliveryPaymentMethod || '') === methodKey
                  return (
                    <button key={methodKey} type="button" className="btn btn--toggle" aria-pressed={active} onClick={() => setCreateForm({ ...createForm, deliveryPaymentMethod: methodKey })}>
                      {method?.label || methodKey}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <button className="btn" onClick={createOrder} disabled={!String(createForm.customerName || '').trim()}>Olustur</button>
        </div>
      </Modal>
    </div>
  )
}
