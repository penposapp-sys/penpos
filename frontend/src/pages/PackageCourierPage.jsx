import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMISSIONS } from '../constants/permissions.js'
import Modal from '../components/Modal.jsx'
import PaymentCollectionModal from '../components/PaymentCollectionModal.jsx'
import { toast } from '../lib/toast.js'
import { isCashPaymentMethod, pickInitialPaymentMethod } from '../lib/paymentMethods.js'

const STATUS_OPTIONS = [
  ['yeni', 'Yeni Sipariş'],
  ['hazirlaniyor', 'Hazırlanıyor'],
  ['hazir', 'Hazır'],
  ['kuryeye_atandi', 'Kuryeye Atandı'],
  ['yola_cikti', 'Yola Çıktı'],
  ['teslim_edildi', 'Teslim Edildi'],
  ['iptal_edildi', 'İptal Edildi'],
  ['geri_dondu', 'Geri Döndü']
]

const PAYMENT_OPTIONS = [
  ['odeme_bekliyor', 'Ödeme Bekliyor'],
  ['odeme_alindi', 'Ödeme Alındı'],
  ['veresiye', 'Veresiye'],
  ['online_odendi', 'Online Ödendi'],
  ['iade_edildi', 'İade Edildi']
]

const statusLabelMap = Object.fromEntries(STATUS_OPTIONS)
const paymentLabelMap = Object.fromEntries(PAYMENT_OPTIONS)

const statusTone = {
  yeni: { bg: '#eff6ff', color: '#2563eb' },
  hazirlaniyor: { bg: '#fff7ed', color: '#ea580c' },
  hazir: { bg: '#ecfdf5', color: '#047857' },
  kuryeye_atandi: { bg: '#fef3c7', color: '#b45309' },
  yola_cikti: { bg: '#dbeafe', color: '#1d4ed8' },
  teslim_edildi: { bg: '#dcfce7', color: '#15803d' },
  iptal_edildi: { bg: '#fee2e2', color: '#dc2626' },
  geri_dondu: { bg: '#fee2e2', color: '#dc2626' },
  musteriyi_bulamadi: { bg: '#fee2e2', color: '#dc2626' },
  adreste_yok: { bg: '#fee2e2', color: '#dc2626' }
}

const prepTone = {
  new: { bg: '#f3f4f6', color: '#475569', label: 'Yeni' },
  preparing: { bg: '#fff7ed', color: '#ea580c', label: 'Hazırlanıyor' },
  ready: { bg: '#dbeafe', color: '#1d4ed8', label: 'Hazır' }
}

const paymentTone = {
  odeme_bekliyor: { bg: '#fff7ed', color: '#ea580c' },
  odeme_alindi: { bg: '#ecfdf5', color: '#16a34a' },
  kismi_odeme: { bg: '#eff6ff', color: '#2563eb' },
  veresiye: { bg: '#e9f0f8', color: '#274066' },
  online_odendi: { bg: '#eff6ff', color: '#2563eb' },
  iade_edildi: { bg: '#fee2e2', color: '#dc2626' }
}

const compactButton = {
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 700,
  border: '1px solid var(--app-border, var(--border))',
  background: 'var(--app-button-bg, var(--button-bg))',
  color: 'var(--app-text, var(--text))',
  cursor: 'pointer'
}

const primaryButton = {
  ...compactButton,
  background: 'var(--theme-accent, #0f172a)',
  borderColor: 'var(--theme-accent, #0f172a)',
  color: '#fff'
}

const successButton = {
  ...compactButton,
  background: '#15803d',
  borderColor: '#15803d',
  color: '#fff'
}

const blueButton = {
  ...compactButton,
  background: '#2563eb',
  borderColor: '#2563eb',
  color: '#fff'
}

const todayYmd = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const money = (value) => `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
const phoneHref = (value) => `tel:${String(value || '').replace(/[^\d+]/g, '')}`

const shortAddress = (value) => {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.length > 78 ? `${text.slice(0, 78)}...` : text
}

const buildProductSummary = (order) => {
  const items = (Array.isArray(order?.items) ? order.items : []).filter((item) => item?.status !== 'cancelled')
  const preview = items.slice(0, 3).map((item) => {
    const qty = Math.max(1, Number(item?.qty || 1))
    return `${qty}x ${String(item?.nameSnapshot || item?.productName || 'Ürün').trim()}`
  })
  return {
    preview: preview.join(', '),
    extraCount: Math.max(0, items.length - preview.length)
  }
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('tr-TR')
}

const formatPaymentState = (order) => {
  if (String(order?.status || '') === 'cancelled' || ['iptal_edildi', 'geri_dondu', 'musteriyi_bulamadi', 'adreste_yok'].includes(String(order?.deliveryStatus || ''))) {
    return 'İptal'
  }
  const balance = Number(order?.balanceDue || 0)
  if (String(order?.paymentStatus || '') === 'paid' || balance <= 0.01) return 'Ödeme Alındı'
  return balance < Number(order?.netTotal || order?.total || 0) ? 'Kısmi Ödeme' : 'Ödeme Bekliyor'
}

const getPaymentPresentation = (order) => {
  if (String(order?.status || '') === 'cancelled' || ['iptal_edildi', 'geri_dondu', 'musteriyi_bulamadi', 'adreste_yok'].includes(String(order?.deliveryStatus || ''))) {
    return { key: 'iade_edildi', label: 'İptal' }
  }
  if (String(order?.deliveryPaymentStatus || '') === 'odeme_alindi' || String(order?.deliveryPaymentStatus || '') === 'online_odendi') {
    return { key: 'odeme_alindi', label: 'Ödeme Alındı' }
  }
  if (String(order?.deliveryPaymentStatus || '') === 'veresiye') {
    return { key: 'veresiye', label: 'Veresiye' }
  }
  const paidTotal = Number(order?.paidTotal || 0)
  const balance = Math.max(0, Number(order?.balanceDue || 0))
  const total = Math.max(0, Number(order?.netTotal || order?.total || 0))
  if (String(order?.paymentStatus || '') === 'paid') return { key: 'odeme_alindi', label: 'Ödeme Alındı' }
  if (String(order?.paymentStatus || '') === 'partial' || (paidTotal > 0.01 && balance > 0.01 && paidTotal < total)) {
    return { key: 'kismi_odeme', label: 'Kısmi Ödeme' }
  }
  return { key: 'odeme_bekliyor', label: 'Ödeme Bekliyor' }
}

export default function PackageCourierPage() {
  const { user, allowedBranchIds } = useAuth()
  const perms = Array.isArray(user?.permissions) ? user.permissions : []
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'superadmin'
  const hasPerm = (permission) => isAdmin || perms.includes(permission)

  const canAssignCourier = hasPerm(PERMISSIONS.PACKAGE_ASSIGN_COURIER) || hasPerm(PERMISSIONS.MANAGE_DELIVERY)
  const canUpdateStatus = hasPerm(PERMISSIONS.PACKAGE_STATUS_UPDATE) || hasPerm(PERMISSIONS.MANAGE_DELIVERY)
  const canTakePayment = hasPerm(PERMISSIONS.TAKE_PAYMENT)
  const canViewReports = hasPerm(PERMISSIONS.COURIER_REPORTS_VIEW) || hasPerm(PERMISSIONS.REPORTS_DASHBOARD_VIEW)
  const canSeePhone = hasPerm(PERMISSIONS.CUSTOMER_PHONE_VIEW) || canAssignCourier
  const canSeeAddress = hasPerm(PERMISSIONS.CUSTOMER_ADDRESS_VIEW) || canAssignCourier
  const canOpenLocation = hasPerm(PERMISSIONS.CUSTOMER_LOCATION_OPEN) || canAssignCourier
  const courierMode = !canAssignCourier

  const [orders, setOrders] = useState([])
  const [couriers, setCouriers] = useState([])
  const [branches, setBranches] = useState([])
  const [reportRows, setReportRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [payMethods, setPayMethods] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState(null)
  const [selectedCourierId, setSelectedCourierId] = useState('')
  const [filters, setFilters] = useState({
    date: todayYmd(),
    branchId: courierMode ? '' : '',
    courierId: '',
    status: '',
    paymentStatus: '',
    search: ''
  })

  const loadOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (String(value || '').trim()) params.set(key, String(value).trim())
      })
      const result = await api(`/api/pos/package-orders?${params.toString()}`, { skipBranchHeader: true, suppressBranchModal: true, silent: true })
      setOrders(Array.isArray(result?.orders) ? result.orders : [])
    } catch (err) {
      toast.error(err.message || 'Paket siparişleri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const loadCouriers = async () => {
    try {
      const result = await api('/api/pos/couriers', { skipBranchHeader: true, suppressBranchModal: true, silent: true })
      setCouriers(Array.isArray(result?.couriers) ? result.couriers : [])
    } catch {}
  }

  const loadBranches = async () => {
    try {
      const result = await api('/api/branches', { skipBranchHeader: true, silent: true })
      const allowed = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String) : []
      const list = Array.isArray(result?.branches) ? result.branches : []
      setBranches(list.filter((branch) => allowed.length === 0 || allowed.includes(String(branch?._id || branch?.id || ''))))
    } catch {}
  }

  const loadReport = async () => {
    if (!canViewReports) return
    setReportLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.date) {
        params.set('startDate', filters.date)
        params.set('endDate', filters.date)
      }
      if (filters.branchId) params.set('branchId', filters.branchId)
      if (filters.courierId) params.set('courierId', filters.courierId)
      const result = await api(`/api/pos/courier-report?${params.toString()}`, { skipBranchHeader: true, suppressBranchModal: true, silent: true })
      setReportRows(Array.isArray(result?.rows) ? result.rows : [])
    } catch (err) {
      toast.error(err.message || 'Kurye raporu yüklenemedi')
    } finally {
      setReportLoading(false)
    }
  }

  const loadPaymentMethods = async () => {
    const selectedBranchId = (() => {
      try { return String(localStorage.getItem('selectedBranchId') || '').trim() } catch { return '' }
    })()
    if (!selectedBranchId) {
      setPayMethods([])
      return
    }
    try {
      const res = await api('/api/tenant/payment-settings', { silent: true, suppressBranchModal: true })
      const methods = Array.isArray(res?.methods) ? res.methods.filter((method) => method.isEnabled) : []
      setPayMethods(methods)
      setPaymentMethod((current) => pickInitialPaymentMethod(methods, current))
    } catch {
      setPayMethods([])
    }
  }

  const refreshData = async ({ includeDetail = true } = {}) => {
    await Promise.all([loadOrders(), loadReport()])
    if (includeDetail && detailOrder?.id) {
      await openDetail(detailOrder.id, { keepOpen: true, silent: true })
    }
  }

  useEffect(() => {
    loadCouriers()
    loadBranches()
    loadPaymentMethods()
  }, [Array.isArray(allowedBranchIds) ? allowedBranchIds.join(',') : ''])

  useEffect(() => {
    loadOrders()
    loadReport()
  }, [filters.date, filters.branchId, filters.courierId, filters.status, filters.paymentStatus, filters.search])

  const summary = useMemo(() => {
    const totalAmount = orders.reduce((sum, order) => sum + Number(order?.total || 0), 0)
    return {
      yeni: orders.filter((order) => order.deliveryStatus === 'yeni').length,
      hazirlaniyor: orders.filter((order) => order.deliveryStatus === 'hazirlaniyor').length,
      hazir: orders.filter((order) => order.deliveryStatus === 'hazir').length,
      yolda: orders.filter((order) => order.deliveryStatus === 'yola_cikti').length,
      teslim: orders.filter((order) => order.deliveryStatus === 'teslim_edildi').length,
      totalAmount
    }
  }, [orders])

  const sortedOrders = useMemo(() => {
    const priority = {
      hazir: 0,
      kuryeye_atandi: 1,
      yola_cikti: 2,
      hazirlaniyor: 3,
      yeni: 4,
      teslim_edildi: 5,
      geri_dondu: 6,
      iptal_edildi: 7
    }
    return [...orders].sort((a, b) => {
      const pa = priority[a.deliveryStatus] ?? 99
      const pb = priority[b.deliveryStatus] ?? 99
      if (pa !== pb) return pa - pb
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
  }, [orders])

  const openDetail = async (orderId, options = {}) => {
    if (!orderId) return
    if (!options.silent) {
      setDetailOpen(true)
      setDetailOrder(null)
    } else if (options.keepOpen) {
      setDetailOpen(true)
    }
    setDetailLoading(true)
    try {
      const result = await api(`/api/pos/package-orders/${orderId}`, { silent: true })
      setDetailOrder(result?.order || null)
      if (!options.silent) setDetailOpen(true)
    } catch (err) {
      if (!options.silent) toast.error(err.message || 'Sipariş detayı alınamadı')
    } finally {
      setDetailLoading(false)
    }
  }

  const openAssign = (order) => {
    setAssignTarget(order)
    setSelectedCourierId(order?.courierId || '')
    setAssignOpen(true)
  }

  const saveAssign = async () => {
    if (!assignTarget?.id || !selectedCourierId) return
    try {
      await api(`/api/pos/package-orders/${assignTarget.id}/assign-courier`, {
        method: 'POST',
        body: JSON.stringify({ courierId: selectedCourierId }),
        silent: true
      })
      toast.success('Kurye atandı')
      setAssignOpen(false)
      await refreshData()
    } catch (err) {
      toast.error(err.message || 'Kurye atanamadı')
    }
  }

  const updateStatus = async (orderId, deliveryStatus) => {
    try {
      await api(`/api/pos/package-orders/${orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ deliveryStatus }),
        silent: true
      })
      toast.success('Durum güncellendi')
      await refreshData()
    } catch (err) {
      toast.error(err.message || 'Durum güncellenemedi')
    }
  }

  const openPaymentModal = async (order) => {
    if (!canTakePayment) return
    setPaymentOpen(true)
    const full = detailOrder?.id === order.id ? detailOrder : null
    if (!full) {
      setDetailOrder(null)
      await openDetail(order.id, { keepOpen: false, silent: true })
    }
    const source = full || order
    const balance = Math.max(0, Number(source?.balanceDue || 0))
    setPaymentAmount(balance > 0 ? String(balance) : '')
    setPaymentNote('')
  }

  const paymentTarget = detailOrder
  const selectedPaymentMethod = (payMethods || []).find((method) => String(method?.key || method?.id || '') === String(paymentMethod || '')) || null
  const selectedPaymentIsCash = isCashPaymentMethod(selectedPaymentMethod)
  const enteredPaymentAmount = Number(paymentAmount || 0)
  const paymentBalance = Math.max(0, Number(paymentTarget?.balanceDue || 0))
  const changeDue = selectedPaymentIsCash ? Math.max(0, enteredPaymentAmount - paymentBalance) : 0

  const submitPayment = async () => {
    if (!paymentTarget?.id) {
      toast.error('Sipariş bulunamadı')
      return
    }
    if (!canTakePayment) {
      toast.error('Ödeme alma yetkiniz yok')
      return
    }
    if (!String(paymentMethod || '').trim()) {
      toast.error('Ödeme tipi seçin')
      return
    }
    const amount = Number(paymentAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Geçerli bir tutar girin')
      return
    }
    setPaymentBusy(true)
    try {
      const result = await api(`/api/pos/package-orders/${paymentTarget.id}/collect-payment`, {
        method: 'POST',
        body: JSON.stringify({ method: paymentMethod, amount, note: paymentNote }),
        silent: true
      })
      const nextOrder = result?.order || null
      setDetailOrder(nextOrder)
      setPaymentAmount(Math.max(0, Number(nextOrder?.balanceDue || 0)) > 0 ? String(Math.max(0, Number(nextOrder?.balanceDue || 0))) : '')
      setPaymentNote('')
      toast.success('Tahsilat kaydedildi')
      await refreshData({ includeDetail: false })
    } catch (err) {
      toast.error(err.message || 'Tahsilat kaydedilemedi')
    } finally {
      setPaymentBusy(false)
    }
  }

  const summaryCards = [
    ['Yeni', summary.yeni],
    ['Hazırlanıyor', summary.hazirlaniyor],
    ['Hazır', summary.hazir],
    ['Yolda', summary.yolda],
    ['Teslim', summary.teslim],
    ['Tutar', money(summary.totalAmount)]
  ]

  const renderOrderActions = (order) => {
    const actions = []
    if (canAssignCourier && order.deliveryStatus === 'hazir') {
      actions.push(
        <button key="assign" type="button" style={primaryButton} onClick={(event) => { event.stopPropagation(); openAssign(order) }}>
          Kuryeye Ata
        </button>
      )
    }
    if (canUpdateStatus && order.deliveryStatus === 'kuryeye_atandi') {
      actions.push(
        <button key="depart" type="button" style={blueButton} onClick={(event) => { event.stopPropagation(); updateStatus(order.id, 'yola_cikti') }}>
          Yola Çıktı
        </button>
      )
    }
    if (canUpdateStatus && order.deliveryStatus === 'yola_cikti') {
      actions.push(
        <button key="delivered" type="button" style={successButton} onClick={(event) => { event.stopPropagation(); updateStatus(order.id, 'teslim_edildi') }}>
          Teslim Edildi
        </button>
      )
    }
    if (canTakePayment && String(order?.status || '') !== 'cancelled' && Number(order?.balanceDue || 0) > 0.01) {
      actions.push(
        <button key="collect" type="button" style={compactButton} onClick={(event) => { event.stopPropagation(); openPaymentModal(order) }}>
          Ödeme Al
        </button>
      )
    }
    actions.push(
      <button key="detail" type="button" style={compactButton} onClick={(event) => { event.stopPropagation(); openDetail(order.id) }}>
        Detay
      </button>
    )
    return actions
  }

  const renderOrderActionsV2 = (order) => {
    const isCancelled = String(order?.status || '') === 'cancelled' || ['iptal_edildi', 'geri_dondu', 'musteriyi_bulamadi', 'adreste_yok'].includes(String(order?.deliveryStatus || ''))
    const isDelivered = String(order?.deliveryStatus || '') === 'teslim_edildi'
    const canDepart = ['hazir', 'kuryeye_atandi'].includes(String(order?.deliveryStatus || ''))
    const canMarkDelivered = ['yola_cikti'].includes(String(order?.deliveryStatus || ''))
    const mapUrl = order?.deliveryAddress?.mapUrl
      || ((order?.deliveryAddress?.latitude && order?.deliveryAddress?.longitude)
        ? `https://www.google.com/maps?q=${order.deliveryAddress.latitude},${order.deliveryAddress.longitude}`
        : '')

    const actions = [
      <button key="detail" type="button" style={compactButton} onClick={(event) => { event.stopPropagation(); openDetail(order.id) }}>
        Detay
      </button>
    ]

    if (isCancelled) return actions

    if (canAssignCourier && !isDelivered) {
      actions.push(
        <button key="assign" type="button" style={primaryButton} onClick={(event) => { event.stopPropagation(); openAssign(order) }}>
          {order?.courierId ? 'Kurye Değiştir' : 'Kurye Ata'}
        </button>
      )
    }
    if (canUpdateStatus && canDepart) {
      actions.push(
        <button key="depart" type="button" style={blueButton} onClick={(event) => { event.stopPropagation(); updateStatus(order.id, 'yola_cikti') }}>
          Yola Çıktı
        </button>
      )
    }
    if (canUpdateStatus && canMarkDelivered) {
      actions.push(
        <button key="delivered" type="button" style={successButton} onClick={(event) => { event.stopPropagation(); updateStatus(order.id, 'teslim_edildi') }}>
          Teslim Edildi
        </button>
      )
    }
    if (canTakePayment && Number(order?.balanceDue || 0) > 0.01) {
      actions.push(
        <button key="collect" type="button" style={compactButton} onClick={(event) => { event.stopPropagation(); openPaymentModal(order) }}>
          Ödeme Al
        </button>
      )
    }
    if (canSeePhone && order.customerPhone) {
      actions.push(
        <a key="call" href={phoneHref(order.customerPhone)} onClick={(event) => event.stopPropagation()} style={{ ...compactButton, textDecoration: 'none' }}>
          Ara
        </a>
      )
    }
    if (canOpenLocation && mapUrl) {
      actions.push(
        <button key="map" type="button" style={compactButton} onClick={(event) => { event.stopPropagation(); window.open(mapUrl, '_blank', 'noopener,noreferrer') }}>
          Konum
        </button>
      )
    }
    return actions
  }

  return (
    <div style={{ minHeight: '100%', display: 'grid', gap: 12 }}>

      <div className="card" style={{ margin: 0, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <input className="input" type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} style={{ minHeight: 40 }} />
        <select className="input" value={filters.branchId} onChange={(event) => setFilters((current) => ({ ...current, branchId: event.target.value }))} style={{ minHeight: 40 }}>
          <option value="">Tüm Şubeler</option>
          {branches.map((branch) => (
            <option key={String(branch?._id || branch?.id || '')} value={String(branch?._id || branch?.id || '')}>{branch?.name || 'Şube'}</option>
          ))}
        </select>
        <select className="input" value={filters.courierId} onChange={(event) => setFilters((current) => ({ ...current, courierId: event.target.value }))} style={{ minHeight: 40 }}>
          <option value="">{courierMode ? 'Benim Siparişlerim' : 'Tüm Kuryeler'}</option>
          {couriers.map((courier) => (
            <option key={courier.id} value={courier.id}>{courier.name}</option>
          ))}
        </select>
        <select className="input" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} style={{ minHeight: 40 }}>
          <option value="">Tüm Durumlar</option>
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="input" value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))} style={{ minHeight: 40 }}>
          <option value="">Tüm Ödemeler</option>
          {PAYMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input className="input" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Sipariş, müşteri, telefon..." style={{ minHeight: 40 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        {summaryCards.map(([label, value]) => (
          <div key={label} className="card" style={{ margin: 0, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--app-text-muted, var(--muted))', fontWeight: 700 }}>{label}</div>
            <div style={{ marginTop: 4, fontSize: 21, color: 'var(--app-text, var(--text))', fontWeight: 900 }}>{value}</div>
          </div>
        ))}
      </div>

      {loading ? <div className="card" style={{ margin: 0 }}>Yükleniyor...</div> : null}
      {!loading && sortedOrders.length === 0 ? <div className="card" style={{ margin: 0 }}>Filtreye uygun sipariş bulunamadı.</div> : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {sortedOrders.map((order) => {
          const deliveryTone = statusTone[order.deliveryStatus] || statusTone.yeni
          const paymentView = getPaymentPresentation(order)
          const payTone = paymentTone[paymentView.key] || paymentTone.odeme_bekliyor
          const preparationTone = prepTone[String(order.preparationStatus || 'new')] || prepTone.new
          const isReadyFlow = ['hazir', 'kuryeye_atandi', 'yola_cikti'].includes(String(order.deliveryStatus || ''))
          const mapUrl = order?.deliveryAddress?.mapUrl
            || ((order?.deliveryAddress?.latitude && order?.deliveryAddress?.longitude)
              ? `https://www.google.com/maps?q=${order.deliveryAddress.latitude},${order.deliveryAddress.longitude}`
              : '')

          return (
            <div
              key={order.id}
              className="card"
              onClick={() => openDetail(order.id)}
              style={{
                margin: 0,
                padding: 12,
                cursor: 'pointer',
                borderColor: isReadyFlow ? '#bbf7d0' : 'var(--border)',
                boxShadow: isReadyFlow ? '0 0 0 1px rgba(22,163,74,0.06)' : 'none'
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 900, fontSize: 16, color: 'var(--app-text, var(--text))' }}>#{order.orderNo || order.id?.slice(-6)}</span>
                      {String(order?.status || '') !== 'cancelled' && String(order.deliveryStatus || '') !== 'teslim_edildi' ? (
                        <span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, background: preparationTone.bg, color: preparationTone.color }}>
                          {preparationTone.label}
                        </span>
                      ) : null}
                      <span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, background: deliveryTone.bg, color: deliveryTone.color }}>{order.deliveryStatusLabel}</span>
                      <span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800, background: payTone.bg, color: payTone.color }}>{paymentView.label}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--app-text, var(--text))' }}>{order.customerName || '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>
                      {canSeePhone ? (order.customerPhone || '-') : 'Telefon gizli'} {' · '}
                      {order.courierName || 'Kurye atanmadı'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, color: 'var(--app-text, var(--text))', fontSize: 17 }}>{money(order.total)}</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>
                      {String(order?.status || '') === 'cancelled' ? 'İptal edildi' : `Kalan ${money(order.balanceDue)}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                  <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))' }}><strong>Adres:</strong> {canSeeAddress ? shortAddress(order?.deliveryAddress?.addressText || order.customerAddress) : 'Gizli'}</div>
                  <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))' }}><strong>Ürün:</strong> {order.itemsSummary || `${order.itemCount || 0} ürün`}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {renderOrderActionsV2(order)}
                  </div>
                  <div />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {canViewReports ? (
        <div className="card" style={{ margin: 0, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--app-text, var(--text))' }}>Kurye Özeti</div>
            {reportLoading ? <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>Yükleniyor...</div> : null}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {reportRows.length === 0 ? <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>Rapor verisi yok.</div> : null}
            {reportRows.map((row) => (
              <div key={row.courierId || row.courierName} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted, var(--muted))' }}>Kurye</div>
                  <div style={{ fontWeight: 800 }}>{row.courierName || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted, var(--muted))' }}>Atanan</div>
                  <div style={{ fontWeight: 800 }}>{row.assignedOrderCount || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted, var(--muted))' }}>Teslim</div>
                  <div style={{ fontWeight: 800 }}>{row.deliveredOrderCount || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted, var(--muted))' }}>Tahsilat</div>
                  <div style={{ fontWeight: 800 }}>{money((row.collectedCashAmount || 0) + (row.collectedCardAmount || 0))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--app-text-muted, var(--muted))' }}>Ort. Teslim</div>
                  <div style={{ fontWeight: 800 }}>{row.averageDeliveryMinutes || 0} dk</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Sipariş Detayı"
        backdropClose={false}
        dialogStyle={{ width: 'min(880px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 28px)' }}
        bodyStyle={{ paddingTop: 14 }}
      >
        {detailLoading ? <div>Yükleniyor...</div> : null}
        {!detailLoading && !detailOrder ? <div>Detay bulunamadı.</div> : null}
        {!detailLoading && detailOrder ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>#{detailOrder.orderNo || detailOrder.id?.slice(-6)} · {detailOrder.customerName || '-'}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>{formatDateTime(detailOrder.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 800, background: (statusTone[detailOrder.deliveryStatus] || statusTone.yeni).bg, color: (statusTone[detailOrder.deliveryStatus] || statusTone.yeni).color }}>{detailOrder.deliveryStatusLabel}</span>
                <span style={{ borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 800, background: (paymentTone[getPaymentPresentation(detailOrder).key] || paymentTone.odeme_bekliyor).bg, color: (paymentTone[getPaymentPresentation(detailOrder).key] || paymentTone.odeme_bekliyor).color }}>{getPaymentPresentation(detailOrder).label}</span>
              </div>
            </div>

            <div className="card" style={{ margin: 0, padding: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))', marginBottom: 8 }}>Müşteri</div>
              <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <div><strong>Telefon:</strong> {canSeePhone ? (detailOrder.customerPhone || '-') : 'Gizli'}</div>
                <div><strong>Adres:</strong> {canSeeAddress ? (detailOrder?.deliveryAddress?.addressText || detailOrder.customerAddress || '-') : 'Gizli'}</div>
                <div><strong>Adres Notu:</strong> {canSeeAddress ? (detailOrder?.deliveryAddress?.note || detailOrder.deliveryNote || '-') : 'Gizli'}</div>
                <div><strong>Sipariş Notu:</strong> {detailOrder.note || detailOrder.deliveryNote || '-'}</div>
              </div>
            </div>

            <div className="card" style={{ margin: 0, padding: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))', marginBottom: 8 }}>Ödeme</div>
              <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <div><strong>Toplam:</strong> {money(detailOrder.netTotal || detailOrder.total)}</div>
                <div><strong>Kalan Bakiye:</strong> {money(detailOrder.balanceDue)}</div>
                <div><strong>Ödeme Tipi:</strong> {detailOrder.deliveryPaymentMethodLabel || detailOrder.paymentMethod || '-'}</div>
                <div><strong>Ödeme Durumu:</strong> {getPaymentPresentation(detailOrder).label}</div>
                <div><strong>Kurye:</strong> {detailOrder.courierName || '-'}</div>
              </div>
            </div>

            <div className="card" style={{ margin: 0, padding: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))', marginBottom: 8 }}>Ürünler</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {(Array.isArray(detailOrder.items) ? detailOrder.items : []).map((item, index) => (
                  <div key={`${detailOrder.id}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item?.nameSnapshot || item?.productName || 'Ürün'}</div>
                      {!!item?.note && <div style={{ color: 'var(--app-text-muted, var(--muted))', fontSize: 12 }}>{item.note}</div>}
                    </div>
                    <div style={{ whiteSpace: 'nowrap', color: 'var(--app-text-secondary, var(--text-secondary))' }}>{item?.qty || 1}x</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ margin: 0, padding: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))', marginBottom: 8 }}>Durum Geçmişi</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(Array.isArray(detailOrder.deliveryEvents) ? detailOrder.deliveryEvents : []).length === 0 ? <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>Kayıt yok.</div> : null}
                {(Array.isArray(detailOrder.deliveryEvents) ? detailOrder.deliveryEvents : []).slice().reverse().map((event, index) => (
                  <div key={`${event.createdAt || index}-${index}`} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--border)', paddingTop: index === 0 ? 0 : 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>{formatDateTime(event.createdAt)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{event.userName || 'Sistem'}</div>
                    <div style={{ fontSize: 13 }}>
                      {statusLabelMap[event.oldStatus] || paymentLabelMap[event.oldStatus] || event.oldStatus || '-'} → {statusLabelMap[event.newStatus] || paymentLabelMap[event.newStatus] || event.newStatus || '-'}
                    </div>
                    {!!event.note && <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>{event.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <PaymentCollectionModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        order={paymentTarget}
        customerLabel="Paket"
        payMethods={payMethods}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        paymentAmount={paymentAmount}
        onPaymentAmountChange={setPaymentAmount}
        paymentNote={paymentNote}
        onPaymentNoteChange={setPaymentNote}
        canTakePayment={canTakePayment}
        busy={paymentBusy}
        previousLines={(Array.isArray(paymentTarget?.payments) ? paymentTarget.payments : []).map((payment) => ({
          kind: 'payment',
          id: String(payment?._id || payment?.id || payment?.createdAt || ''),
          amount: Number(payment?.amount || 0),
          label: payment?.methodLabel || payment?.methodName || payment?.method || '-',
          note: payment?.note || '',
          createdAt: payment?.createdAt || payment?.paidAt || null,
          canDelete: false
        }))}
        selectedPaymentIsCash={selectedPaymentIsCash}
        changeDue={changeDue}
        onSubmit={submitPayment}
        submitLabel="Kaydet / Tahsil Et"
        dialogStyle={{ width: 'min(720px, calc(100vw - 24px))' }}
      />

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Kuryeye Ata">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ margin: 0, padding: 10 }}>
            <div style={{ fontWeight: 800 }}>#{assignTarget?.orderNo || assignTarget?.id?.slice(-6)}</div>
            <div style={{ marginTop: 4 }}>{assignTarget?.customerName || '-'}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>{assignTarget?.deliveryAddress?.addressText || assignTarget?.customerAddress || '-'}</div>
          </div>
          <select className="input" value={selectedCourierId} onChange={(event) => setSelectedCourierId(event.target.value)}>
            <option value="">Kurye seç</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>{courier.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={() => setAssignOpen(false)}>Vazgeç</button>
            <button type="button" className="btn btn--primary" onClick={saveAssign} disabled={!selectedCourierId}>Kaydet</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

