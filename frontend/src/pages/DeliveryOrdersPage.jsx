import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import InputModal from '../components/InputModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSafeOrderActions } from '../lib/useSafeOrderActions.js'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import SaleCategorySidebar from '../components/SaleCategorySidebar.jsx'
import { trPaymentMethodLabel } from '../i18n/tr.js'
import ProductCard from '../components/ProductCard.jsx'
import { enqueueReceiptPrint } from '../lib/printingClient.js'

export default function DeliveryOrdersPage() {
  const { user, allowedBranchIds } = useAuth()
  const { isMobilePortrait } = useResponsiveFlags()
  const nav = useNavigate()
  const { orderId: routeOrderId } = useParams()
  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canTakePayment = hasPerm('take_payment')
  const canCreateVeresiye = hasPerm('create_veresiye')
  const canViewAccounts = hasPerm('view_accounts')
  const canManageAccounts = hasPerm('manage_accounts')
  const canManageDelivery = hasPerm('manage_delivery')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('active')
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [deliveredOnlyLastHours, setDeliveredOnlyLastHours] = useState(24)
  
  // Detail Panel State
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [order, setOrder] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [discountDraft, setDiscountDraft] = useState(0)
  const [veresiyeOpen, setVeresiyeOpen] = useState(false)
  const [accountQuery, setAccountQuery] = useState('')
  const [accountResults, setAccountResults] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false)
  const [createAccountForm, setCreateAccountForm] = useState({ name: '', phone: '', note: '' })
  const [createAccountError, setCreateAccountError] = useState('')
  const createAccountNameRef = useRef(null)
  const createAccountPhoneRef = useRef(null)
  const inflightRef = useRef(new Map())
  const lastClickRef = useRef(new Map())
  const [veresiyeAmount, setVeresiyeAmount] = useState('')
  const [veresiyeNote, setVeresiyeNote] = useState('')
  const [payMethods, setPayMethods] = useState([])
  
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [selectedItemForNote, setSelectedItemForNote] = useState(null)
  const [itemNote, setItemNoteText] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedItemForCancel, setSelectedItemForCancel] = useState(null)

  const [inlineNoteItemId, setInlineNoteItemId] = useState(null)
  const [inlineNoteText, setInlineNoteText] = useState('')
  const [inlineCancelItemId, setInlineCancelItemId] = useState(null)
  const [inlineCancelReason, setInlineCancelReason] = useState('')
  const [orderCancelConfirmOpen, setOrderCancelConfirmOpen] = useState(false)
  const [itemCancelConfirmOpen, setItemCancelConfirmOpen] = useState(false)
  
  const [busy, setBusy] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState(false)
  const [tempQty, setTempQty] = useState({})
  const [cartViewMode, setCartViewMode] = useState('grouped')

  const withLock = async (key, fn) => {
    if (!key) return null
    if (inflightRef.current.get(key)) return null
    inflightRef.current.set(key, true)
    try {
      return await fn()
    } finally {
      inflightRef.current.delete(key)
    }
  }

  const isDebounced = (key, ms = 250) => {
    if (!key) return true
    const now = Date.now()
    const last = Number(lastClickRef.current.get(key) || 0)
    if (now - last < ms) return true
    lastClickRef.current.set(key, now)
    return false
  }

  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ customerName: '', phone: '', address: '', note: '' })
  const [createOrderError, setCreateOrderError] = useState('')

  const [customerEditOpen, setCustomerEditOpen] = useState(false)
  const [customerEditForm, setCustomerEditForm] = useState({ customerName: '', phone: '', address: '' })

  const pickOrder = (res) => res?.data?.order ?? res?.order ?? null
  const getOrderId = (o) => o?._id || o?.id || o?.orderId || null
  const normalizeOrder = (o) => {
    const id = getOrderId(o)
    return id ? { ...o, id } : o
  }

  const { busy: actionBusy, safeAction, reloadOrder } = useSafeOrderActions({
    getOrderId: () => selectedId,
    orderId: selectedId,
    setOrder,
    pickOrder
  })

  const syncOrderToList = (fresh) => {
    if (!fresh) return
    const norm = normalizeOrder(fresh)
    setOrders(prev => prev.map(o => ((getOrderId(o) === getOrderId(norm)) ? { ...o, ...norm } : o)))
  }

  const printReceiptOneClick = async () => {
    const oid = getOrderId(order)
    if (!oid) {
      toast.error('Sipariş bulunamadı')
      return
    }
    setPrintingReceipt(true)
    try {
      await enqueueReceiptPrint({ system: 'kermes', orderId: oid, copyCount: 1 })
      toast.success('Fiş kuyruğa alındı')
    } catch (e) {
      toast.error(e?.message || 'Fiş yazdırma başarısız')
    } finally {
      setPrintingReceipt(false)
    }
  }

  useEffect(() => {
    setBusy(actionBusy)
  }, [actionBusy])

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
      const q = nextTab === 'delivered' ? 'delivered' : 'active'
      const limit = q === 'delivered' ? 50 : 50
      const qp = new URLSearchParams()
      qp.set('status', q)
      qp.set('limit', String(limit))
      qp.set('page', String(nextPage))
      if (q === 'delivered' && deliveredOnlyLastHours > 0) {
        qp.set('onlyLastHours', String(deliveredOnlyLastHours))
      }
      const { ids, params } = buildBranchQueryParams(allowedBranchIds)
      if (!params || ids.length === 0) {
        setOrders([])
        setTotalCount(0)
        return
      }
      for (const [k, v] of qp.entries()) {
        params.set(k, v)
      }
      const res = await api(`/api/pos/delivery/orders?${params.toString()}`, { skipBranchHeader: true, suppressBranchModal: true })
      const nextOrders = (Array.isArray(res?.orders) ? res.orders : []).map(normalizeOrder)
      setTotalCount(Number(res?.total || 0))
      setOrders(prev => append ? [...prev, ...nextOrders] : nextOrders)
      setPage(nextPage)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    const res = await api('/api/tenant/categories?active=true')
    if (res?.success === false) {
      setCategories([])
      setActiveCategory('')
      return
    }
    const categories = Array.isArray(res?.categories) ? res.categories : []
    setCategories(categories)
    setActiveCategory(categories[0]?.id || '')
  }
  const loadItems = async (categoryId) => {
    const res = await api(`/api/tenant/menu-items?active=true${categoryId ? `&categoryId=${categoryId}` : ''}`)
    if (res?.success === false) {
      setItems([])
      return
    }
    const items = Array.isArray(res?.items) ? res.items : []
    setItems(items)
  }

  useEffect(() => {
    loadOrders(tab)
    loadCategories()
    const loadPaymentSettings = async () => {
      try {
        const res = await api('/api/tenant/payment-settings')
        if (res?.success === false) {
          setPayMethods([])
          return
        }
        const methods = Array.isArray(res?.methods) ? res.methods : []
        setPayMethods(methods.filter(m => m.isEnabled))
        const def = methods.find(m => m.isDefault && m.isEnabled)
        if (def) setPaymentMethod(def.key)
      } catch {}
    }
    loadPaymentSettings()
  }, [])

  useEffect(() => {
    loadOrders(tab, { page: 1, append: false })
    setSelectedId(null)
    setOrder(null)
    setNote('')
  }, [tab])

  useEffect(() => {
    if (tab !== 'delivered') return
    loadOrders('delivered', { page: 1, append: false })
  }, [tab, deliveredOnlyLastHours])

  useEffect(() => { if (activeCategory) loadItems(activeCategory) }, [activeCategory])

  useEffect(() => {
    if (!selectedId) {
      setOrder(null)
      return
    }
    const fetchOrder = async () => {
      const res = await safeAction((signal) => api(`/api/pos/orders/${selectedId}`, { signal, silent: true }), { reload: false })
      const fresh = pickOrder(res)
      if (fresh) {
        const norm = normalizeOrder(fresh)
        setOrder(norm)
        setNote(norm.note || '')
      }
    }
    fetchOrder()
  }, [selectedId])

  useEffect(() => {
    if (!isMobilePortrait) return
    if (routeOrderId) {
      if (String(selectedId || '') !== String(routeOrderId)) {
        setSelectedId(routeOrderId)
      }
      return
    }
    if (selectedId) setSelectedId(null)
    if (order) setOrder(null)
  }, [isMobilePortrait, routeOrderId])

  const createOrder = async () => {
    setCreateOrderError('')
    const safeCustomerName = String(createForm.customerName || '').trim()
    const safePhone = String(createForm.phone || '').trim()
    const safeAddress = String(createForm.address || '').trim()
    const safeNote = String(createForm.note || '').trim()
    if (!safeCustomerName) {
      toast.error('Müşteri adı zorunlu')
      return
    }
    try {
      const res = await api('/api/pos/delivery/orders', {
        method: 'POST',
        body: JSON.stringify({ customerName: safeCustomerName, phone: safePhone, address: safeAddress, note: safeNote }),
        silent: true
      })
      if (res?.success === false && res?.status === 403) {
        if (res?.code === 'missing_branch') {
          const msg = res?.message || 'Şube seçimi gerekli. Çıkış yapıp tekrar giriş yapın veya admin’den şube yetkisi isteyin.'
          setCreateOrderError(msg)
          toast.error(msg)
          return
        }
        toast.error(res?.message || 'Bu işlem için yetkiniz yok')
        return
      }
      const fresh = pickOrder(res)
      if (fresh) {
        const normalizedFresh = normalizeOrder(fresh)
        setOrders([normalizedFresh, ...orders])
        setSelectedId(getOrderId(normalizedFresh))
        setCreateOpen(false)
        setCreateForm({ customerName: '', phone: '', address: '', note: '' })
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Sunucu hatası. Tekrar deneyin.')
    }
  }

  const updateStatus = async (status) => {
    if (!order) return
    if (!canManageDelivery) {
      toast.error('Bu işlem için yetkiniz yok')
      return
    }
    const isDelivered = String(status) === 'delivered'
    const res = await safeAction((signal) => api(`/api/pos/delivery/orders/${order.id}/status`, {
      method: 'PUT',
      body: JSON.stringify(isDelivered ? { status: 'delivered' } : { deliveryStatus: status }),
      signal,
      silent: true
    }))
    const fresh = pickOrder(res)
    if (fresh) {
      const norm = normalizeOrder(fresh)
      if (isDelivered && tab === 'active') {
        toast.success('Sipariş teslim edildi')
        setOrders(orders.filter(o => getOrderId(o) !== getOrderId(norm)))
        setSelectedId(null)
        setOrder(null)
        setNote('')
        return
      }
      setOrders(orders.map(o => ((getOrderId(o) === getOrderId(norm)) ? norm : o)))
    }
  }

  const openCustomerEdit = () => {
    if (!order) return
    setCustomerEditForm({
      customerName: String(order?.customerName || ''),
      phone: String(order?.customerPhone || ''),
      address: String(order?.customerAddress || '')
    })
    setCustomerEditOpen(true)
  }

  const saveCustomerEdit = async () => {
    if (!order) return
    if (!canManageDelivery) {
      toast.error('Bu işlem için yetkiniz yok')
      return
    }
    const customerName = String(customerEditForm.customerName || '').trim()
    const phone = String(customerEditForm.phone || '').trim()
    const address = String(customerEditForm.address || '').trim()
    if (!customerName) {
      toast.error('Müşteri adı zorunlu')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/delivery/orders/${order.id}/customer`, {
      method: 'PUT',
      body: JSON.stringify({ customerName, phone, address }),
      signal,
      silent: true
    }))
    const fresh = pickOrder(res)
    if (fresh) {
      const norm = normalizeOrder(fresh)
      setOrders(prev => prev.map(o => ((getOrderId(o) === getOrderId(norm)) ? { ...o, ...norm } : o)))
      setCustomerEditOpen(false)
    }
  }

  // Copied methods
  const addItem = async (menuItemId) => {
    if (tab === 'delivered') return
    setError('')
    const orderId = selectedId || getOrderId(order)
    const key = `${orderId}:${menuItemId}:add`
    if (isDebounced(key, 200)) return
    const result = await withLock(key, () => safeAction((signal) => api(`/api/pos/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify({ menuItemId }), signal, silent: true })))
    const fresh = pickOrder(result)
    if (fresh) setNote(fresh.note || '')
  }
  const removeItem = async (menuItemId) => {
    if (tab === 'delivered') return
    const orderId = selectedId || getOrderId(order)
    const result = await safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${menuItemId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(result)
    if (fresh) setNote(fresh.note || '')
  }
  const submitItemNoteFor = async (itemId, val) => {
    const safeItemId = String(itemId || '').trim()
    if (!safeItemId) return
    if (tab === 'delivered') return
    const orderId = selectedId || getOrderId(order)
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${safeItemId}/note`, { method: 'PUT', body: JSON.stringify({ note: val }), signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) setNote(fresh.note || '')
    setNoteModalOpen(false)
    setInlineNoteItemId(null)
  }
  const openItemNoteModal = (itemId, currentNote) => {
    if (isMobilePortrait) {
      setInlineCancelItemId(null)
      setInlineCancelReason('')
      setInlineNoteItemId(itemId)
      setInlineNoteText(String(currentNote || ''))
      return
    }
    setSelectedItemForNote(itemId)
    setItemNoteText(currentNote || '')
    setNoteModalOpen(true)
  }

  const submitItemNote = async (val) => {
    if (!selectedItemForNote) return
    return submitItemNoteFor(selectedItemForNote, val)
  }

  const submitItemCancelFor = async (itemId, val) => {
    const safeItemId = String(itemId || '').trim()
    if (!safeItemId) return
    if (tab === 'delivered') return
    const reason = String(val || '').trim()
    if (!reason) {
      toast.error('İptal nedeni zorunlu')
      return false
    }
    const orderId = selectedId || getOrderId(order)
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${safeItemId}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }), signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) setNote(fresh.note || '')
    setCancelModalOpen(false)
    setInlineCancelItemId(null)
    setInlineCancelReason('')
  }

  const openItemCancelModal = (item) => {
    const itemId = item?.id || item?._id || item
    if (!itemId) return
    if (isMobilePortrait) {
      setInlineNoteItemId(null)
      setInlineNoteText('')
      setInlineCancelItemId(itemId)
      setInlineCancelReason('')
      return
    }
    setSelectedItemForCancel(itemId)
    setItemCancelConfirmOpen(true)
  }

  const submitItemCancel = async (val) => {
    if (!selectedItemForCancel) return
    return submitItemCancelFor(selectedItemForCancel, val)
  }
  const saveNote = async () => {
    if (tab === 'delivered') return
    const orderId = selectedId || getOrderId(order)
    if (!orderId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/note`, { method: 'PUT', body: JSON.stringify({ note }), signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) setNote(fresh.note || '')
  }
  const cancelOrder = async () => {
    const orderId = selectedId || getOrderId(order)
    if (!orderId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/cancel`, { method: 'PUT', signal, silent: true }))
    if (res) toast.success('Sipariş iptal edildi')
    await reloadOrder().catch(() => null)
  }

  const closeOrder = async () => {
    const orderId = selectedId || getOrderId(order)
    if (!orderId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/close`, { method: 'PUT', signal, silent: true }))
    if (res) toast.success('Sipariş kapatıldı')
    if (isMobilePortrait) {
      nav('/kermes/app/delivery')
      return
    }
    await reloadOrder().catch(() => null)
  }
  const sendKitchen = async () => {
    if (tab === 'delivered') return
    const orderId = selectedId || getOrderId(order)
    if (!orderId) return
    await safeAction((signal) => api(`/api/pos/orders/${orderId}/send`, { method: 'PUT', signal, silent: true }))
    await reloadOrder()
  }
  const payOrder = async () => {
    if (!canTakePayment) {
      toast.error('Ödeme alma yetkiniz yok')
      return
    }
    const orderId = order?._id || order?.id || selectedId
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      return
    }
    const amount = paymentAmount ? Number(paymentAmount) : 0
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ method: paymentMethod, amount, note: paymentNote }),
      signal,
      silent: true
    }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const reloaded = await reloadOrder().catch(() => null)
      const latest = reloaded || fresh
      syncOrderToList(latest)
      const due = Math.max(0, Number(latest?.netTotal ?? latest?.totals?.netTotal ?? 0) - Number(latest?.paidTotal ?? latest?.totals?.paidTotal ?? 0))
      setPaymentAmount(due > 0 ? String(due) : '')
      setPaymentNote('')
    }
  }

  const applyDiscount = async () => {
    if (!canTakePayment) {
      toast.error('İndirim yetkiniz yok')
      return
    }
    const orderId = order?._id || order?.id || selectedId
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/discount`, {
      method: 'PUT',
      body: JSON.stringify({ discountPercent: Number(discountDraft) }),
      signal,
      silent: true
    }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const reloaded = await reloadOrder().catch(() => null)
      const latest = reloaded || fresh
      syncOrderToList(latest)
      const due = Math.max(0, Number(latest?.netTotal ?? latest?.totals?.netTotal ?? 0) - Number(latest?.paidTotal ?? latest?.totals?.paidTotal ?? 0))
      setPaymentAmount(due > 0 ? String(due) : '')
    }
  }

  const deletePayment = async (paymentId) => {
    if (!canTakePayment) {
      toast.error('Ödeme silme yetkiniz yok')
      return
    }
    const orderId = order?._id || order?.id || selectedId
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/payments/${paymentId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const reloaded = await reloadOrder().catch(() => null)
      const latest = reloaded || fresh
      syncOrderToList(latest)
      const due = Math.max(0, Number(latest?.netTotal ?? latest?.totals?.netTotal ?? 0) - Number(latest?.paidTotal ?? latest?.totals?.paidTotal ?? 0))
      setPaymentAmount(due > 0 ? String(due) : '')
    }
  }

  const openVeresiye = () => {
    if (!canCreateVeresiye) {
      toast.error('Veresiye yetkiniz yok')
      return
    }
    setVeresiyeOpen(true)
    setAccountQuery('')
    setAccountResults([])
    setSelectedAccount(null)
    searchAccounts('')
    setVeresiyeAmount(balanceDue > 0 ? String(balanceDue) : '')
    setVeresiyeNote('')
  }

  const searchAccounts = async (q) => {
    if (!canViewAccounts) return
    setAccountsLoading(true)
    try {
      const res = await api(`/api/accounts?q=${encodeURIComponent(q || '')}&limit=20`)
      setAccountResults(res.accounts || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAccountsLoading(false)
    }
  }

  useEffect(() => {
    if (!veresiyeOpen) return
    const t = setTimeout(() => {
      searchAccounts(accountQuery)
    }, 250)
    return () => clearTimeout(t)
  }, [veresiyeOpen, accountQuery])

  const submitCreateAccount = async () => {
    if (!canManageAccounts) {
      toast.error('Cari oluşturma yetkiniz yok')
      return
    }
    const name = String(createAccountForm.name || '').trim()
    if (!name) {
      toast.error('Ad Soyad zorunlu')
      return
    }
    setCreateAccountError('')
    const res = await api('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name, phone: createAccountForm.phone, note: createAccountForm.note }),
      silent: true
    })
    if (!res?.ok) {
      if (res?.code === 'duplicate') {
        const msg = String(res?.message || 'Kayıt zaten var')
        setCreateAccountError(msg)
        const field = String(res?.field || '')
        if (field === 'phone') createAccountPhoneRef.current?.focus?.()
        else createAccountNameRef.current?.focus?.()
        return
      }
      const msg = String(res?.message || 'İşlem başarısız')
      setCreateAccountError(msg)
      return
    }
    const acc = res?.account || null
    const newId = acc?.id || acc?._id || null
    if (newId) {
      const nextAcc = { ...acc, id: newId }
      setAccountResults((prev) => {
        const list = Array.isArray(prev) ? prev : []
        const filtered = list.filter(a => String(a?.id || a?._id) !== String(newId))
        return [nextAcc, ...filtered]
      })
      setSelectedAccount(nextAcc)
    }
    toast.success('Cari oluşturuldu')
    setIsCreateAccountOpen(false)
    setCreateAccountForm({ name: '', phone: '', note: '' })
    setCreateAccountError('')
  }

  const submitVeresiye = async () => {
    if (!selectedAccount?.id) {
      toast.error('Cari seçiniz')
      return
    }
    const orderId = order?._id || order?.id || selectedId
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      return
    }
    const rawAmount = String(veresiyeAmount || '').trim()
    const parsedAmount = rawAmount ? Number(rawAmount) : NaN
    const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined
    const payload = { accountId: selectedAccount.id, note: veresiyeNote }
    if (amount !== undefined) payload.amount = amount

    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/veresiye`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      silent: true
    }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      setVeresiyeOpen(false)
    }
  }

  const deleteVeresiyeEntry = async (entryId) => {
    const orderId = order?._id || order?.id || selectedId
    if (!orderId || !entryId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/veresiye/${entryId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const deleteCollection = async (txId) => {
    const orderId = order?._id || order?.id || selectedId
    if (!orderId || !txId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/collections/${txId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const uiStatus = computeUiStatus(order)
  const isOrderDelivered = uiStatus === 'delivered'
  const hasOpenItems = (order?.items || []).some(it => it.status === 'open')
  const canSendToKitchen = !!order && hasOpenItems && !isOrderDelivered

  const statusColors = {
    pending: '#fbbf24',
    accepted: '#3b82f6',
    preparing: '#8b5cf6',
    ready: '#10b981',
    delivered: '#22c55e',
    cancelled: '#ef4444'
  }
  const statusLabels = {
    pending: 'Bekliyor',
    accepted: 'Onaylandı',
    preparing: 'Hazırlanıyor',
    ready: 'Hazır',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal'
  }

  function computeUiStatus(o) {
    const ord = o || {}
    if (String(ord.status || '') === 'cancelled' || String(ord.deliveryStatus || '') === 'cancelled') return 'cancelled'
    if (ord.deliveredAt || String(ord.status || '') === 'delivered' || String(ord.deliveryStatus || '') === 'delivered') return 'delivered'
    const raw = Array.isArray(ord.items) ? ord.items : []
    if (raw.length === 0) return 'pending'
    const hasCompleted = raw.some(it => it?.status === 'completed')
    if (hasCompleted) return 'ready'
    const hasSent = raw.some(it => it?.status === 'sent' || it?.status === 'preparing')
    if (hasSent) return 'preparing'
    const hasOpen = raw.some(it => it?.status === 'open')
    if (hasOpen) return 'pending'
    return 'pending'
  }

  const formatDeliveredTime = (o) => {
    const dt = o?.deliveredAt || o?.deliveryAt || null
    if (!dt) return ''
    try {
      const d = new Date(dt)
      if (Number.isNaN(d.getTime())) return ''
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    } catch {
      return ''
    }
  }

  const deliveredHourPresets = [
    { label: '24s', value: 24 },
    { label: '48s', value: 48 },
    { label: '7g', value: 168 }
  ]

  const grossTotal = Number(order?.total ?? order?.totals?.total ?? order?.totals?.grandTotal ?? 0)
  const discountPercent = Number(order?.discountPercent ?? 0)
  const discountTotal = Number(order?.discountTotal ?? order?.totals?.discountTotal ?? (grossTotal * discountPercent) / 100)
  const netTotal = Number(order?.netTotal ?? order?.totals?.netTotal ?? Math.max(0, grossTotal - discountTotal))
  const paidTotal = Number(order?.paidTotal ?? order?.totals?.paidTotal ?? 0)
  const balanceDue = Math.max(0, netTotal - paidTotal)
  const payments = Array.isArray(order?.payments) ? order.payments : []

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
  const signedBalance = (() => {
    const v = round2(netTotal - paidTotal)
    return Math.abs(v) <= 0.01 ? 0 : v
  })()
  const signedBalanceLabel = signedBalance < -0.01 ? 'Fazla' : 'Kalan'
  const signedBalanceValue = signedBalance < -0.01 ? Math.abs(signedBalance) : signedBalance

  const cashPaidTotal = payments
    .filter(p => String(p?.method || '') === 'cash')
    .reduce((sum, p) => sum + (Number(p?.amount) || 0), 0)
  const tenderedCash = paymentMethod === 'cash' ? (Number(paymentAmount) || 0) : 0
  const changeDue = (order?.settlementType === 'veresiye')
    ? 0
    : (paymentMethod === 'cash'
      ? Math.max(0, (cashPaidTotal + tenderedCash) - netTotal)
      : 0)

  const previousLines = useMemo(() => {
    const out = []
    const payments = Array.isArray(order?.payments) ? order.payments : []
    for (const p of payments) {
      out.push({
        kind: 'payment',
        id: String(p?._id || p?.id || ''),
        createdAt: p?.createdAt || p?.paidAt || null,
        amount: Number(p?.amount || 0) || 0,
        label: trPaymentMethodLabel(p?.method),
        note: String(p?.note || ''),
        accountName: '',
        canDelete: !!canTakePayment
      })
    }
    const ver = Array.isArray(order?.veresiyeEntries) ? order.veresiyeEntries : []
    for (const v of ver) {
      out.push({
        kind: 'veresiye',
        id: String(v?._id || v?.id || ''),
        createdAt: v?.createdAt || null,
        amount: Number(v?.amount || 0) || 0,
        label: 'Veresiye',
        note: String(v?.note || ''),
        accountName: String(v?.accountName || '-'),
        canDelete: !!canCreateVeresiye
      })
    }
    const col = Array.isArray(order?.linkedCollections) ? order.linkedCollections : []
    for (const c of col) {
      out.push({
        kind: 'collection',
        id: String(c?.id || c?._id || ''),
        createdAt: c?.createdAt || null,
        amount: Number(c?.amount || 0) || 0,
        label: 'Cari Tahsilat',
        note: String(c?.note || ''),
        accountName: String(c?.accountName || '-'),
        canDelete: !!canTakePayment
      })
    }
    return out
      .filter(x => x.id)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  }, [order?.payments, order?.veresiyeEntries, order?.linkedCollections, canTakePayment, canCreateVeresiye])

  const showList = !isMobilePortrait || !routeOrderId
  const showDetail = !isMobilePortrait || !!routeOrderId
  const gridCols = showList && showDetail ? '300px 1fr' : '1fr'

  return (
    <div className="splitLayout splitLayoutStretch vhFit" style={{ gridTemplateColumns: gridCols }}>
      {showList && (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn--toggle"
            onClick={() => setTab('active')}
            aria-pressed={tab === 'active'}
          >
            Aktif Siparişler
          </button>
          <button
            className="btn btn--toggle"
            onClick={() => setTab('delivered')}
            aria-pressed={tab === 'delivered'}
          >
            Teslim Edilenler
          </button>
        </div>

        {tab === 'delivered' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Varsayılan: son teslim edilenler ({Math.min(50, totalCount || 0)} / {totalCount || 0})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {deliveredHourPresets.map(p => (
                <button
                  key={p.value}
                  className="btn btn--toggle"
                  onClick={() => setDeliveredOnlyLastHours(p.value)}
                  disabled={loading}
                  aria-pressed={deliveredOnlyLastHours === p.value}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn btn--full"
          onClick={() => {
            if (!canManageDelivery) {
              toast.error('Bu işlem için yetkiniz yok')
              return
            }
            setTab('active')
            setCreateOpen(true)
          }}
        >
          Yeni Paket Sipariş
        </button>
        <div style={{ overflowY: isMobilePortrait ? 'visible' : 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: isMobilePortrait ? '0 0 auto' : 1 }}>
          {orders.map((o, idx) => (
            (() => {
              const oTotal = Number(o?.netTotal ?? o?.totals?.netTotal ?? o?.totals?.grandTotal ?? o?.total ?? o?.totals?.total ?? 0)
              const oPaid = (() => {
                const paid = Number(o?.paidTotal ?? o?.totals?.paidTotal)
                if (Number.isFinite(paid)) return paid
                const payments = Array.isArray(o?.payments) ? o.payments : []
                if (payments.length > 0) {
                  return payments.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0)
                }
                return 0
              })()
              const oBalanceDue = Number(o?.balanceDue ?? o?.totals?.balanceDue ?? Math.max(0, oTotal - oPaid))
              const isSelected = selectedId === (getOrderId(o) || o.id)
              const deliveredTime = formatDeliveredTime(o)
              const computed = computeUiStatus(o)
              return (
            <div
              key={getOrderId(o) || o.id || `order-${idx}`}
              onClick={() => {
                const oid = getOrderId(o) || o.id
                if (!oid) return
                if (isMobilePortrait) {
                  nav(`/kermes/app/delivery/${oid}`)
                  return
                }
                setSelectedId(oid)
              }}
              style={{
                padding: 12,
                border: isSelected ? '2px solid #9ca3af' : '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: isSelected ? '#f3f4f6' : '#ffffff',
                color: 'var(--text)'
              }}
            >
              <div style={{ fontWeight: 600 }}>{o.customerName}</div>
              {o?.orderNo ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Sipariş {o.orderNo}</div>
              ) : null}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{o.customerPhone}</div>
              {tab === 'delivered' && !!deliveredTime && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Teslim: {deliveredTime}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
                <span className="page-pill" style={{ color: statusColors[computed] }}>{statusLabels[computed]}</span>
                {tab !== 'delivered' && (
                  <span style={{ fontWeight: 700 }}>{oPaid.toFixed(2)} TL</span>
                )}
              </div>

              {tab === 'delivered' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, marginTop: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--muted)' }}>Toplam</div>
                  <div style={{ fontWeight: 600 }}>{oTotal.toFixed(2)} TL</div>
                  <div style={{ color: 'var(--muted)' }}>Ödenen</div>
                  <div style={{ fontWeight: 600 }}>{oPaid.toFixed(2)} TL</div>
                  <div style={{ color: 'var(--muted)' }}>Kalan</div>
                  <div style={{ fontWeight: 800 }}>{oBalanceDue.toFixed(2)} TL</div>
                </div>
              )}
            </div>
              )
            })()
          ))}
        </div>

        {tab === 'delivered' && orders.length < totalCount && (
          <button className="btn" onClick={() => loadOrders('delivered', { page: page + 1, append: true })} disabled={loading}>
            Daha fazla yükle
          </button>
        )}
      </div>

      )}

      {showDetail && (
      <div className="card" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, overflow: 'hidden' }}>
        {!order ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>{isMobilePortrait ? 'Yükleniyor...' : 'Sipariş seçiniz'}</div>
        ) : (
          <>
            {isMobilePortrait && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <button className="btn" type="button" onClick={() => nav('/kermes/app/delivery')}>
                  Listeye Dön
                </button>
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                  {order?.orderNo ? `Sipariş ${order.orderNo}` : ''}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>{order.customerName}</h3>
                  <button className="btn" onClick={openCustomerEdit} disabled={busy || !canManageDelivery}>Düzenle</button>
                </div>
                <div style={{ color: 'var(--muted)' }}>{order.customerPhone}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{order.customerAddress}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {order?.orderNo ? `Sipariş ${order.orderNo}` : ''}{order?.createdByName ? ` • Alan: ${order.createdByName}` : ''}
                </div>
                {order.deliveryNote && <div style={{ color: '#fbbf24', fontSize: 13, marginTop: 4 }}>Not: {order.deliveryNote}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="page-pill" style={{ color: statusColors[uiStatus] }}>{statusLabels[uiStatus]}</span>
                <button className="btn" onClick={printReceiptOneClick} disabled={busy || printingReceipt || !getOrderId(order)}>
                  Fiş Yazdır
                </button>
                {uiStatus !== 'delivered' && uiStatus !== 'cancelled' && (
                  <button className="btn" onClick={() => updateStatus('delivered')} disabled={busy || !canManageDelivery}>
                    Teslim Et
                  </button>
                )}
                {uiStatus === 'cancelled' && (
                  <button className="btn" onClick={closeOrder} disabled={busy}>
                    Kapat
                  </button>
                )}
              </div>
            </div>

            <div className="saleStandard3Col" style={{ minHeight: 0, height: '100%' }}>
              <SaleCategorySidebar categories={categories} activeCategoryId={activeCategory} onSelect={setActiveCategory} />

              <div className="card salePanel">
                <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>Ürünler</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} ürün</div>
                </div>
                <div className="salePanelScroll" style={{ paddingTop: 10 }}>
                  <div className="posItemsGrid">
                    {items.map(i => (
                      <ProductCard
                        key={i.id}
                        item={i}
                        disabled={tab === 'delivered'}
                        onClick={() => addItem(i.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="card salePanel" style={{ gap: 12 }}>
                <div className="saleCartHeader" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--toggle" onClick={() => setCartViewMode('grouped')} disabled={busy} aria-pressed={cartViewMode === 'grouped'}>
                      ✓ Toplu
                    </button>
                    <button className="btn btn--toggle" onClick={() => setCartViewMode('separate')} disabled={busy} aria-pressed={cartViewMode === 'separate'}>
                      Ayrı
                    </button>
                  </div>
                  <span className="page-pill">Paket</span>
                </div>
                <div className="saleCartList" style={{ marginTop: 12 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(() => {
                    const raw = Array.isArray(order?.items) ? order.items : []
                    const openItems = raw.filter(it => it?.status === 'open')
                    const sentItems = raw.filter(it => it?.status === 'sent' || it?.status === 'preparing')
                    const otherItems = raw.filter(it => it?.status === 'completed' || it?.status === 'cancelled')

                    const setItemQtyById = async (itemId, nextQty) => {
                      const orderId = getOrderId(order)
                      if (!orderId) { toast.error('Sipariş bulunamadı'); return }
                      const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${itemId}/quantity`, {
                        method: 'PUT',
                        body: JSON.stringify({ quantity: nextQty }),
                        signal,
                        silent: true
                      }))
                      const fresh = pickOrder(res)
                      if (fresh) setNote(fresh.note || '')
                    }

                    const openRender = cartViewMode === 'grouped'
                      ? Object.values(openItems.reduce((acc, it) => {
                        const k = `${String(it.menuItemId)}|${String(it.note || '')}|${String(it.status)}`
                        const prev = acc[k]
                        if (!prev) {
                          acc[k] = { key: `g:${k}`, menuItemId: it.menuItemId, itemId: it._id, itemIds: [it._id].filter(Boolean), note: it.note || '', qty: Number(it.qty) || 0, subtotal: Number(it.subtotal) || 0, repr: it }
                        } else {
                          prev.qty += Number(it.qty) || 0
                          prev.subtotal += Number(it.subtotal) || 0
                          if (it._id) prev.itemIds.push(it._id)
                        }
                        return acc
                      }, {}))
                      : openItems.map((it, idx) => ({ key: it._id || `${it.menuItemId}-${idx}`, menuItemId: it.menuItemId, itemId: it._id, itemIds: [it._id].filter(Boolean), note: it.note || '', qty: Number(it.qty) || 0, subtotal: Number(it.subtotal) || 0, repr: it }))

                    const otherRender = cartViewMode === 'grouped'
                      ? Object.values(otherItems.reduce((acc, it) => {
                        const k = `${String(it.menuItemId)}|${String(it.note || '')}|${String(it.status)}`
                        const prev = acc[k]
                        if (!prev) {
                          acc[k] = { key: `o:${k}`, menuItemId: it.menuItemId, itemId: it._id, note: it.note || '', qty: Number(it.qty) || 0, subtotal: Number(it.subtotal) || 0, repr: it }
                        } else {
                          prev.qty += Number(it.qty) || 0
                          prev.subtotal += Number(it.subtotal) || 0
                        }
                        return acc
                      }, {}))
                      : otherItems.map((it, idx) => ({ key: it._id || `${it.menuItemId}-other-${idx}`, menuItemId: it.menuItemId, itemId: it._id, note: it.note || '', qty: Number(it.qty) || 0, subtotal: Number(it.subtotal) || 0, repr: it }))

                    const renderLine = (row, opts = {}) => {
                      const it = row.repr
                      const isOpen = opts.type === 'open'
                      const isSent = opts.type === 'sent'
                      const isGrouped = opts.grouped === true
                      const isMultiGroup = isGrouped && Array.isArray(row.itemIds) && row.itemIds.length > 1
                      const disableBase = tab === 'delivered' || busy || it?.status === 'completed' || it?.status === 'cancelled'

                      const itemStatusMeta = {
                        open: { label: 'Bekliyor', bg: '#f3f4f6', border: '#d1d5db', color: '#374151' },
                        sent: { label: 'Hazırlanıyor', bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
                        preparing: { label: 'Hazırlanıyor', bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
                        completed: { label: 'Hazır', bg: '#ecfdf5', border: '#6ee7b7', color: '#047857' },
                        cancelled: { label: 'İptal', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
                      }
                      const m = itemStatusMeta[String(it?.status || '')] || null

                      return (
                        <div key={row.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, opacity: (it?.status === 'completed' || it?.status === 'cancelled') ? 0.6 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {!!m && (
                                <span className="page-pill" style={{ background: m.bg, borderColor: m.border, color: m.color, marginBottom: 2, display: 'inline-block' }}>
                                  {m.label}
                                </span>
                              )}
                              <div>{it?.nameSnapshot}</div>
                            </div>
                            <div>{row.subtotal} TL</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            {isOpen ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <button className="btn btn--xs" onClick={() => setItemQtyById(row.itemId, Math.max(0, Number(it?.qty || 0) - 1))} disabled={disableBase || isMultiGroup} title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}>-</button>
                                <span>{row.qty}</span>
                                <button className="btn btn--xs" onClick={() => setItemQtyById(row.itemId, Number(it?.qty || 0) + 1)} disabled={disableBase || isMultiGroup} title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}>+</button>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>x{row.qty}</div>
                            )}
                            {(isOpen || isSent) ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <button className="btn btn--xs" onClick={() => openItemNoteModal(row.itemId, row.note)} disabled={disableBase || isMultiGroup} title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}>Not</button>
                                {isSent && (
                                  <button className="btn btn--xs" onClick={() => openItemCancelModal(row.itemId)} disabled={disableBase || isMultiGroup} title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}>İptal</button>
                                )}
                                {!isGrouped && (
                                  <input
                                    type="number"
                                    min="1"
                                    className="input"
                                    style={{ width: 72 }}
                                    value={tempQty[row.key] ?? row.qty}
                                    onChange={(e) => setTempQty({ ...tempQty, [row.key]: Math.max(1, Number(e.target.value) || 1) })}
                                    onBlur={async (e) => {
                                      const nextQty = Math.max(1, Number(e.target.value) || 1)
                                      await setItemQtyById(row.itemId, nextQty)
                                    }}
                                    disabled={disableBase || isMultiGroup || !isOpen}
                                  />
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{it?.status}</div>
                            )}
                          </div>
                          {isMobilePortrait && inlineNoteItemId === row.itemId && (
                            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                              <textarea className="input" rows={3} value={inlineNoteText} onChange={(e) => setInlineNoteText(e.target.value)} />
                              <div className="stackRow">
                                <button className="btn btn--primary btn--full" type="button" disabled={disableBase} onClick={async () => { await submitItemNoteFor(row.itemId, inlineNoteText) }}>
                                  Kaydet
                                </button>
                                <button className="btn btn--full" type="button" onClick={() => { setInlineNoteItemId(null); setInlineNoteText('') }}>
                                  İptal
                                </button>
                              </div>
                            </div>
                          )}
                          {isMobilePortrait && inlineCancelItemId === row.itemId && (
                            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                              <textarea className="input" rows={3} placeholder="İptal sebebi" value={inlineCancelReason} onChange={(e) => setInlineCancelReason(e.target.value)} />
                              <div className="stackRow">
                                <button className="btn btn--danger btn--full" type="button" disabled={disableBase} onClick={async () => { await submitItemCancelFor(row.itemId, inlineCancelReason) }}>
                                  İptal Et
                                </button>
                                <button className="btn btn--full" type="button" onClick={() => { setInlineCancelItemId(null); setInlineCancelReason('') }}>
                                  Vazgeç
                                </button>
                              </div>
                            </div>
                          )}
                          {!!row.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{row.note}</div>}
                        </div>
                      )
                    }

                    return (
                      <>
                        {openRender.map(r => renderLine(r, { type: 'open', grouped: cartViewMode === 'grouped' }))}
                        {sentItems.length > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mutfağa Gönderilenler</div>}
                        {sentItems.map((it, idx) => renderLine({ key: it._id || `${it.menuItemId}-sent-${idx}`, menuItemId: it.menuItemId, itemId: it._id, itemIds: [it._id].filter(Boolean), note: it.note || '', qty: Number(it.qty) || 0, subtotal: Number(it.subtotal) || 0, repr: it }, { type: 'sent' }))}
                        {otherItems.length > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tamamlanan / İptal</div>}
                        {otherRender.map(r => renderLine(r, { type: 'other', grouped: cartViewMode === 'grouped' }))}
                      </>
                    )
                  })()}
                </div>

                </div>

                <div className="saleCartFooter" style={{ display: 'grid', gap: 10 }}>
                  <div className="card" style={{ borderColor: 'var(--border)', display: 'grid', gap: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>Ödemeler</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{payments.length} kayıt</div>
                    </div>

                    {payments.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ödeme yok</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {payments.map((p) => (
                          <div key={p._id || p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{ display: 'grid' }}>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(p.createdAt || p.paidAt || Date.now()).toLocaleString('tr-TR')}</div>
                              <div style={{ fontWeight: 600 }}>{trPaymentMethodLabel(p.method) || '-'}</div>
                            </div>
                            <div style={{ fontWeight: 700 }}>{Number(p.amount || 0).toFixed(2)} TL</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 4, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ color: 'var(--muted)' }}>Toplam</div>
                        <div style={{ fontWeight: 700 }}>{netTotal.toFixed(2)} TL</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ color: 'var(--muted)' }}>Ödenen</div>
                        <div style={{ fontWeight: 600 }}>{paidTotal.toFixed(2)} TL</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ color: 'var(--muted)' }}>{signedBalanceLabel}</div>
                        <div style={{ fontWeight: 800 }}>{signedBalanceValue.toFixed(2)} TL</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <button className="btn" onClick={sendKitchen} disabled={tab === 'delivered' || busy || !canSendToKitchen}>Mutfağa Gönder</button>
                    <button
                      className="btn"
                      onClick={() => {
                        setDiscountDraft(Number(order?.discountPercent || 0))
                        setPaymentAmount(signedBalance > 0.01 ? String(signedBalance) : '')
                        setPaymentNote('')
                        setPayOpen(true)
                      }}
                      disabled={!getOrderId(order)}
                    >Ödeme Al</button>
                    <button className="btn" onClick={() => setOrderCancelConfirmOpen(true)} disabled={order.paymentStatus === 'paid' || order.status === 'cancelled'}>İptal Et</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Paket Sipariş">
        <div style={{ display: 'grid', gap: 10 }}>
          {!!createOrderError && (
            <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
              <div style={{ fontWeight: 700, color: '#b91c1c' }}>Şube seçimi gerekli</div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>{createOrderError}</div>
            </div>
          )}
          <label>Ad <input className="input" value={createForm.customerName} onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })} /></label>
          <label>Tel <input className="input" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></label>
          <label>Adres <textarea className="input" value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} /></label>
          <label>Not <input className="input" value={createForm.note} onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} /></label>
          <button className="btn" onClick={createOrder} disabled={!String(createForm.customerName || '').trim()}>Oluştur</button>
        </div>
      </Modal>

      <Modal open={customerEditOpen} onClose={() => setCustomerEditOpen(false)} title="Müşteri Düzenle">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={customerEditForm.customerName} onChange={(e) => setCustomerEditForm({ ...customerEditForm, customerName: e.target.value })} disabled={busy} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tel</div>
            <input className="input" value={customerEditForm.phone} onChange={(e) => setCustomerEditForm({ ...customerEditForm, phone: e.target.value })} disabled={busy} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Adres</div>
            <textarea className="input" value={customerEditForm.address} onChange={(e) => setCustomerEditForm({ ...customerEditForm, address: e.target.value })} disabled={busy} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={saveCustomerEdit} disabled={busy}>Kaydet</button>
            <button className="btn" onClick={() => setCustomerEditOpen(false)} disabled={busy}>Vazgeç</button>
          </div>
        </div>
      </Modal>

      {/* Modals reused */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Ödeme Al">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Paket — {order?.customerName || 'Müşteri'} • {order?.orderNo ? `Sipariş ${order.orderNo}` : `Sipariş #${(order?.id || '').slice(-6)}`}
          </div>

          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Brüt</div>
                <div style={{ fontWeight: 600 }}>{grossTotal.toFixed(2)} TL</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ color: 'var(--muted)' }}>İndirim (%)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    style={{ width: 120 }}
                    value={discountDraft}
                    onChange={(e) => setDiscountDraft(e.target.value)}
                    disabled={!canTakePayment || busy}
                  />
                  <button className="btn" onClick={applyDiscount} disabled={!canTakePayment || busy}>
                    Uygula
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>İndirim Tutarı</div>
                <div style={{ fontWeight: 600 }}>{discountTotal.toFixed(2)} TL</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Net</div>
                <div style={{ fontWeight: 700 }}>{netTotal.toFixed(2)} TL</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Ödenen</div>
                <div style={{ fontWeight: 600 }}>{paidTotal.toFixed(2)} TL</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>{signedBalanceLabel}</div>
                <div style={{ fontWeight: 700 }}>{signedBalanceValue.toFixed(2)} TL</div>
              </div>
            </div>
          </div>

          {previousLines.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--border)' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Önceki Ödemeler</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {previousLines.map((r) => (
                  <div key={`${r.kind}:${r.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'grid' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(r.createdAt || Date.now()).toLocaleString()}</div>
                      <div style={{ fontWeight: 600 }}>
                        {Number(r.amount || 0).toFixed(2)} TL • {r.label}
                        {(r.accountName && r.accountName !== '-') ? ` • ${r.accountName}` : ''}
                      </div>
                      {!!r.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.note}</div>}
                    </div>
                    {r.canDelete && (
                      <button
                        className="btn"
                        onClick={() => {
                          if (r.kind === 'payment') return deletePayment(r.id)
                          if (r.kind === 'veresiye') return deleteVeresiyeEntry(r.id)
                          if (r.kind === 'collection') return deleteCollection(r.id)
                        }}
                        disabled={busy}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yöntem</div>
                <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={!canTakePayment || busy}>
                  {payMethods.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tutar</div>
                <input
                  type="number"
                  className="input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Tutar giriniz"
                  disabled={!canTakePayment || busy}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not (opsiyonel)</div>
                <input className="input" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} disabled={!canTakePayment || busy} />
              </label>
              {paymentMethod === 'cash' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                  <div>Paraüstü</div>
                  <div style={{ fontWeight: 600 }}>{changeDue.toFixed(2)} TL</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={payOrder} disabled={!canTakePayment || busy || balanceDue <= 0.01}>
                  Ödeme Ekle
                </button>
                <button className="btn" onClick={openVeresiye} disabled={!canCreateVeresiye || busy || balanceDue <= 0.01}>
                  Veresiye Yap
                </button>
                <button className="btn" onClick={() => setPayOpen(false)} disabled={busy}>
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={veresiyeOpen} onClose={() => setVeresiyeOpen(false)} title="Veresiye Yap">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kalan: {balanceDue.toFixed(2)} TL</div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Cari Ara (isim/telefon)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} disabled={!canViewAccounts || busy} />
              <button className="btn" onClick={() => searchAccounts(accountQuery)} disabled={!canViewAccounts || busy}>
                Ara
              </button>
              {(user?.role === 'tenant_admin' || user?.role === 'superadmin' || canManageAccounts) && (
                <button
                  className="btn"
                  onClick={() => {
                    setCreateAccountForm({ name: '', phone: '', note: '' })
                    setIsCreateAccountOpen(true)
                  }}
                  disabled={busy}
                >
                  + Yeni Cari
                </button>
              )}
            </div>
          </label>
          <div className="card" style={{ borderColor: 'var(--border)', maxHeight: 220, overflowY: 'auto' }}>
            {accountsLoading && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
            {(accountResults || []).map(a => (
              <div
                key={a.id}
                onClick={() => setSelectedAccount(a)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: selectedAccount?.id === a.id ? '#eff6ff' : 'transparent'
                }}
              >
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.phone || '-'} • Bakiye: {Number(a.balance || 0).toFixed(2)} TL</div>
              </div>
            ))}
            {!accountsLoading && (accountResults || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Sonuç yok</div>}
          </div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tutar</div>
            <input type="number" className="input" value={veresiyeAmount} onChange={(e) => setVeresiyeAmount(e.target.value)} disabled={busy} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
            <input className="input" value={veresiyeNote} onChange={(e) => setVeresiyeNote(e.target.value)} disabled={busy} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submitVeresiye} disabled={!selectedAccount?.id || busy}>
              Onayla
            </button>
            <button className="btn" onClick={() => setVeresiyeOpen(false)} disabled={busy}>
              Vazgeç
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={isCreateAccountOpen} onClose={() => { setIsCreateAccountOpen(false); setCreateAccountError('') }} title="Yeni Cari">
        <div style={{ display: 'grid', gap: 10 }}>
          {!!createAccountError && (
            <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
              <div style={{ fontWeight: 700, color: '#b91c1c' }}>{createAccountError}</div>
            </div>
          )}
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad Soyad (Zorunlu)</div>
            <input ref={createAccountNameRef} className="input" value={createAccountForm.name} onChange={(e) => setCreateAccountForm({ ...createAccountForm, name: e.target.value })} disabled={busy} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
            <input ref={createAccountPhoneRef} className="input" value={createAccountForm.phone} onChange={(e) => setCreateAccountForm({ ...createAccountForm, phone: e.target.value })} disabled={busy} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
            <input className="input" value={createAccountForm.note} onChange={(e) => setCreateAccountForm({ ...createAccountForm, note: e.target.value })} disabled={busy} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submitCreateAccount} disabled={busy}>
              Kaydet
            </button>
            <button className="btn" onClick={() => setIsCreateAccountOpen(false)} disabled={busy}>
              Vazgeç
            </button>
          </div>
        </div>
      </Modal>
      <InputModal open={noteModalOpen} onClose={() => setNoteModalOpen(false)} title="Not" initialValue={itemNote} onSubmit={submitItemNote} />
      <InputModal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="İptal Sebebi" onSubmit={submitItemCancel} />
      <ConfirmModal open={orderCancelConfirmOpen} onClose={() => setOrderCancelConfirmOpen(false)} title="Siparişi İptal Et?" onConfirm={() => { setOrderCancelConfirmOpen(false); cancelOrder() }} />
      <ConfirmModal open={itemCancelConfirmOpen} onClose={() => setItemCancelConfirmOpen(false)} title="Ürünü İptal Et?" onConfirm={() => { setItemCancelConfirmOpen(false); setCancelModalOpen(true) }} />
    </div>
  )
}
