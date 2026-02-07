import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import InputModal from '../components/InputModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { isValidObjectId } from '../lib/ids.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useSafeOrderActions } from '../lib/useSafeOrderActions.js'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import SaleCategorySidebar from '../components/SaleCategorySidebar.jsx'
import { trPaymentMethodLabel } from '../i18n/tr.js'
import ProductCard from '../components/ProductCard.jsx'
import { servingTypeToApi } from '../lib/servingType.js'
import { enqueueReceiptPrint } from '../lib/printingClient.js'

export default function WalkInPosPage() {
  const nav = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { isMobilePortrait } = useResponsiveFlags()
  const routeOrderId = params?.orderId || null
  const isOrderView = !!routeOrderId && isValidObjectId(routeOrderId)
  const { user, allowedBranchIds } = useAuth()
  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canTakePayment = hasPerm('take_payment')
  const canCreateVeresiye = hasPerm('create_veresiye')
  const canViewAccounts = hasPerm('view_accounts')
  const canManageAccounts = hasPerm('manage_accounts')
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [activeOrders, setActiveOrders] = useState([])
  const [loadingList, setLoadingList] = useState(false)

  const [order, setOrder] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState(false)
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
  const [createForm, setCreateForm] = useState({ name: '', phone: '', note: '' })
  const [createAccountError, setCreateAccountError] = useState('')
  const createAccountNameRef = useRef(null)
  const createAccountPhoneRef = useRef(null)
  const [veresiyeAmount, setVeresiyeAmount] = useState('')
  const [veresiyeNote, setVeresiyeNote] = useState('')
  const [veresiyeBranchError, setVeresiyeBranchError] = useState('')
  
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [selectedItemForNote, setSelectedItemForNote] = useState(null)
  const [itemNote, setItemNoteText] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedItemForCancel, setSelectedItemForCancel] = useState(null)
  const [orderCancelConfirmOpen, setOrderCancelConfirmOpen] = useState(false)
  const [itemCancelConfirmOpen, setItemCancelConfirmOpen] = useState(false)
  const [customerNameDraft, setCustomerNameDraft] = useState('')
  
  const [busy, setBusy] = useState(false)
  const [tempQty, setTempQty] = useState({})
  const [cartViewMode, setCartViewMode] = useState('grouped')
  const [servingType, setServingType] = useState('plate')

  const [payMethods, setPayMethods] = useState([])
  const inflightRef = useRef(new Map())
  const lastClickRef = useRef(new Map())
  const [, setLockTick] = useState(0)
  const cartAnchorRef = useRef(null)
  const kitchenDefaultRef = useRef(true)
  const kitchenDefaultAppliedRef = useRef(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pos_send_to_kitchen_default')
      kitchenDefaultRef.current = raw === '0' ? false : true
    } catch {
      kitchenDefaultRef.current = true
    }
  }, [])

  const effectiveKitchenEnabled = typeof order?.kitchenEnabled === 'boolean' ? order.kitchenEnabled : kitchenDefaultRef.current

  const setKitchenMode = async (next) => {
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) return
    const key = `${orderId}:kitchen-mode`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/kitchen-mode`, { method: 'PUT', data: { kitchenEnabled: Boolean(next) }, signal, silent: true }),
      { reload: false }
    ))
    if (!res) return
    const fresh = pickOrder(res)
    if (fresh) {
      setOrder(fresh)
    } else {
      setOrder(prev => (prev ? { ...prev, kitchenEnabled: Boolean(next), sendToKitchen: Boolean(next) } : prev))
    }
    try {
      localStorage.setItem('pos_send_to_kitchen_default', next ? '1' : '0')
    } catch {}
    await reloadOrder().catch(() => null)
  }

  useEffect(() => {
    if (!isOrderView) return
    const oid = getOrderId(order)
    if (!oid) return
    if (kitchenDefaultAppliedRef.current.has(String(oid))) return
    const desired = kitchenDefaultRef.current
    if (typeof order?.kitchenEnabled === 'boolean' && order.kitchenEnabled === desired) {
      kitchenDefaultAppliedRef.current.add(String(oid))
      return
    }
    const items = Array.isArray(order?.items) ? order.items : []
    const payments = Array.isArray(order?.payments) ? order.payments : []
    const isFresh = items.length === 0 && payments.length === 0 && (order?.status === 'open' || order?.status === 'sent')
    if (!isFresh) {
      kitchenDefaultAppliedRef.current.add(String(oid))
      return
    }
    kitchenDefaultAppliedRef.current.add(String(oid))
    setKitchenMode(desired)
  }, [isOrderView, order?.id, order?._id])

  const withLock = async (key, fn) => {
    if (!key) return null
    if (inflightRef.current.get(key)) return null
    inflightRef.current.set(key, true)
    setLockTick(x => x + 1)
    try {
      return await fn()
    } finally {
      inflightRef.current.delete(key)
      setLockTick(x => x + 1)
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

  const normalizeOrder = (o) => {
    if (!o || typeof o !== 'object') return o
    const id = o.id || o._id || o.orderId || null
    return id ? { ...o, id } : o
  }

  const pickOrder = (res) => {
    const o = res?.data?.order ?? res?.order ?? null
    return normalizeOrder(o)
  }
  const getOrderId = (o) => o?._id || o?.id || o?.orderId || null

  const printReceiptOneClick = async () => {
    const orderId = getOrderId(order)
    if (!orderId) return toast.error('Sipariş yok')
    if (printingReceipt) return
    setPrintingReceipt(true)
    try {
      const r = await enqueueReceiptPrint({ system: 'kermes', orderId, copyCount: 1 })
      toast.success(r?.queuedWithoutStation ? 'Fiş kuyruğa alındı (aktif istasyon yoksa basılmaz).' : 'Fiş yazdırma kuyruğa gönderildi.')
    } catch (e) {
      toast.error(`Yazdırma gönderilemedi: ${e?.message || 'Hata'}`)
    } finally {
      setTimeout(() => setPrintingReceipt(false), 300)
    }
  }
  const selectedOrderId = isOrderView ? routeOrderId : null

  const { busy: actionBusy, safeAction, reloadOrder } = useSafeOrderActions({
    getOrderId: () => selectedOrderId,
    orderId: selectedOrderId,
    setOrder,
    pickOrder,
    reloadUrlForOrderId: (id) => `/api/pos/orders/${id}`
  })

  useEffect(() => {
    setBusy(actionBusy)
  }, [actionBusy])

  useEffect(() => {
    if (!order) return
    const v = order?.servingType
    if (v === 'tray' || v === 'plate') {
      setServingType(v)
    }
  }, [order?.id, order?.servingType])

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
    if (!isOrderView) return
    loadCategories()
  }, [isOrderView])
  useEffect(() => {
    if (!isOrderView) return
    if (activeCategory) loadItems(activeCategory)
  }, [activeCategory, isOrderView])

  useEffect(() => {
    if (!isOrderView) return
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
  }, [isOrderView])

  const getListOrderId = (o) => o?._id || o?.id || null

  const loadActiveOrders = async (opts = {}) => {
    setLoadingList(true)
    try {
      const { ids, params } = buildBranchQueryParams(allowedBranchIds)
      if (!params || ids.length === 0) {
        setActiveOrders([])
        return
      }
      params.set('limit', '50')
      const res = await api(`/api/pos/walkin/orders?${params.toString()}`, { silent: true, skipBranchHeader: true })
      const list = Array.isArray(res?.orders) ? res.orders : []
      setActiveOrders(list)
    } catch (err) {
      setActiveOrders([])
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (isOrderView) return
    loadActiveOrders()
  }, [isOrderView, Array.isArray(allowedBranchIds) ? allowedBranchIds.join(',') : ''])

  useEffect(() => {
    if (isOrderView) return
    const removedOrderId = location?.state?.removedOrderId || null
    if (!removedOrderId) return
    setActiveOrders(prev => prev.filter(o => String(getListOrderId(o)) !== String(removedOrderId)))
  }, [isOrderView, location?.state?.removedOrderId])

  useEffect(() => {
    if (!selectedOrderId || !isOrderView) {
      setOrder(null)
      setNote('')
      return
    }
    const run = async () => {
      const res = await api(`/api/pos/orders/${selectedOrderId}`, { silent: true })
      if (!res?.ok) return
      const fresh = pickOrder(res)
      if (fresh) {
        setOrder(fresh)
        setNote(fresh.note || '')
      }
    }
    run()
  }, [selectedOrderId, isOrderView])

  const startWalkInOrder = async () => {
    try {
      const res = await api('/api/pos/walkin/orders', {
        method: 'POST',
        data: { customerName: 'Misafir', note: '' },
        silent: true
      })
      const fresh = pickOrder(res)
      const newId = getOrderId(fresh)
      if (!newId) {
        toast.error('Sipariş başlatılamadı')
        return
      }
      nav(`/kermes/app/walkin/${newId}`)
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Sunucu hatası. Tekrar deneyin.')
    }
  }

  const addItem = async (menuItemId) => {
    setError('')
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const key = `${orderId}:${menuItemId}:add`
    if (isDebounced(key, 200)) return
    const result = await withLock(key, () => safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/items`, { method: 'POST', data: { menuItemId }, signal, silent: true }),
      { reload: false }
    ))
    const fresh = pickOrder(result)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const removeItem = async (menuItemId) => {
    setError('')
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const result = await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/items/${menuItemId}`, { method: 'DELETE', signal, silent: true }),
      { reload: false }
    )
    const fresh = pickOrder(result)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const openItemNoteModal = (itemId, currentNote) => {
    setSelectedItemForNote(itemId)
    setItemNoteText(currentNote || '')
    setNoteModalOpen(true)
  }

  const submitItemNote = async (val) => {
    if (!selectedItemForNote) return
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const key = `${orderId}:${selectedItemForNote}:note`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/items/${selectedItemForNote}/note`, { method: 'PUT', data: { note: val }, signal, silent: true }),
      { reload: false }
    ))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
    setNoteModalOpen(false)
  }
  const openItemCancelModal = (item) => {
    const itemId = item?.id || item?._id || item
    if (!itemId) return
    setSelectedItemForCancel(itemId)
    setItemCancelConfirmOpen(true)
  }
  const submitItemCancel = async (val) => {
    if (!selectedItemForCancel) return
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const key = `${orderId}:${selectedItemForCancel}:cancel`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/items/${selectedItemForCancel}/cancel`, { method: 'PUT', signal, silent: true }),
      { reload: false }
    ))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
    setCancelModalOpen(false)
  }
  const saveNote = async () => {
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/note`, { method: 'PUT', data: { note }, signal, silent: true }),
      { reload: false }
    )
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const cancelOrder = async () => {
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      return
    }
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/cancel`, { method: 'PUT', signal, silent: true }),
      { reload: false }
    )
    if (res) toast.success('Sipariş iptal edildi')
  }

  const closeSelectedOrder = async () => {
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      return
    }

    if (balanceDue > 0.01) {
      nav('/kermes/app/walkin')
      return
    }

    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/close`, { method: 'PUT', signal, silent: true }),
      { reload: false }
    )
    if (!res) return
    const fresh = pickOrder(res)
    if (fresh) {
      toast.success('Sipariş kapatıldı')
    }
    nav('/kermes/app/walkin', { state: { removedOrderId: orderId } })
  }

  const sendKitchen = async () => {
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }

    const apiServingType = servingTypeToApi(servingType)
    const payload = {
      ...(apiServingType ? { servingType: apiServingType } : {}),
      kitchenEnabled: effectiveKitchenEnabled !== false
    }
    await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/send`, { method: 'PUT', data: payload, signal, silent: true }),
      { reload: false }
    )
    await reloadOrder().catch(() => null)
  }

  useEffect(() => {
    if (!getOrderId(order)) return
    const next = String(order?.customerName || '').trim() || 'Misafir'
    setCustomerNameDraft(next)
  }, [order?.id, order?.customerName])

  const saveCustomerName = async (rawName) => {
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) return
    const customerName = String(rawName || '').trim() || 'Misafir'
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/customer`, { method: 'PUT', data: { customerName }, signal, silent: true }),
      { reload: false }
    )
    const fresh = pickOrder(res)
    if (fresh) setOrder(fresh)
    await reloadOrder().catch(() => null)
  }


  const payOrder = async () => {
    if (!canTakePayment) {
      toast.error('Ödeme alma yetkiniz yok')
      return
    }
    const currentOrderId = order?._id || order?.id || selectedOrderId
    if (!currentOrderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const amount = paymentAmount ? Number(paymentAmount) : 0
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${currentOrderId}/payments`, { method: 'POST', data: { method: paymentMethod, amount, note: paymentNote }, signal, silent: true }),
      { reload: false }
    )
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
      setPaymentNote('')
    }
    await reloadOrder().catch(() => null)
  }

  const applyDiscount = async () => {
    if (!canTakePayment) {
      toast.error('İndirim yetkiniz yok')
      return
    }
    const currentOrderId = order?._id || order?.id || selectedOrderId
    if (!currentOrderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${currentOrderId}/discount`, { method: 'PUT', data: { discountPercent: Number(discountDraft) }, signal, silent: true }),
      { reload: false }
    )
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
    }
    await reloadOrder().catch(() => null)
  }

  const deletePayment = async (paymentId) => {
    if (!canTakePayment) {
      toast.error('Ödeme silme yetkiniz yok')
      return
    }
    const currentOrderId = order?._id || order?.id || selectedOrderId
    if (!currentOrderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${currentOrderId}/payments/${paymentId}`, { method: 'DELETE', signal, silent: true }),
      { reload: false }
    )
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
    }
    await reloadOrder().catch(() => null)
  }

  const openVeresiye = () => {
    if (!canCreateVeresiye) {
      toast.error('Veresiye yetkiniz yok')
      return
    }
    setVeresiyeOpen(true)
    setVeresiyeBranchError('')
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
      const { params } = buildBranchQueryParams(allowedBranchIds)
      if (!params) {
        setAccountResults([])
        setVeresiyeBranchError('Şube yetkisi yok. Ayarlar > Sistem Ayarları > Yetkili Şubeler’den şube seç.')
        return
      }
      params.set('q', String(q || ''))
      params.set('limit', '20')
      const res = await api(`/api/accounts?${params.toString()}`, { skipBranchHeader: true })
      setAccountResults(res.accounts || [])
    } catch (err) {
      const code = err?.data?.code || err?.data?.error || err?.code
      if (err?.status === 403 && code === 'missing_branch') {
        const msg = 'Şube yetkisi yok. Ayarlar > Sistem Ayarları > Yetkili Şubeler’den şube seç.'
        setVeresiyeBranchError(msg)
        toast.error(msg)
        return
      }
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
    setVeresiyeBranchError('')
    setCreateAccountError('')
    const name = String(createForm.name || '').trim()
    if (!name) {
      toast.error('Ad Soyad zorunlu')
      createAccountNameRef.current?.focus?.()
      return
    }
    const res = await api('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name, phone: createForm.phone, note: createForm.note }),
      silent: true
    })
    if (!res?.ok) {
      if (res?.status === 403 && res?.code === 'missing_branch') {
        const msg = 'Şube seçimi gerekli. Çıkış yapıp tekrar giriş yapın veya admin’den şube yetkisi isteyin.'
        setVeresiyeBranchError(msg)
        toast.error(msg)
        return
      }
      if (res?.code === 'duplicate') {
        const msg = String(res?.message || 'Kayıt zaten var')
        setCreateAccountError(msg)
        const field = String(res?.field || '')
        if (field === 'phone') createAccountPhoneRef.current?.focus?.()
        else createAccountNameRef.current?.focus?.()
        return
      }
      setCreateAccountError(String(res?.message || 'Sunucu hatası. Tekrar deneyin.'))
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
    setCreateForm({ name: '', phone: '', note: '' })
    setCreateAccountError('')
  }

  const submitVeresiye = async () => {
    if (!selectedAccount?.id) {
      toast.error('Cari seçiniz')
      return
    }
    const currentOrderId = order?._id || order?.id || selectedOrderId
    if (!currentOrderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    setVeresiyeBranchError('')
    try {
      const res = await api(`/api/pos/orders/${currentOrderId}/veresiye`, {
        method: 'POST',
        data: {
          accountId: selectedAccount.id,
          amount: veresiyeAmount ? Number(veresiyeAmount) : undefined,
          note: veresiyeNote
        },
        silent: true
      })
      const fresh = pickOrder(res)
      if (fresh) {
        setOrder(fresh)
        setNote(fresh.note || '')
        setVeresiyeOpen(false)
      }
    } catch (err) {
      const code = err?.data?.code || err?.data?.error || err?.code
      if (err?.status === 403 && code === 'missing_branch') {
        const msg = 'Şube seçimi gerekli. Çıkış yapıp tekrar giriş yapın veya admin’den şube yetkisi isteyin.'
        setVeresiyeBranchError(msg)
        toast.error(msg)
        return
      }
      toast.error(err?.data?.message || err?.message || 'Sunucu hatası. Tekrar deneyin.')
    }
  }

  const hasOpenItems = (order?.items || []).some(it => it.status === 'open')
  const canSendToKitchen = !!order && hasOpenItems
  const grossTotal = Number(order?.total ?? order?.totals?.total ?? order?.totals?.grandTotal ?? 0)
  const discountPercent = Number(order?.discountPercent ?? 0)
  const discountTotal = Number(order?.discountTotal ?? order?.totals?.discountTotal ?? (grossTotal * discountPercent) / 100)
  const netTotal = Number(order?.netTotal ?? order?.totals?.netTotal ?? Math.max(0, grossTotal - discountTotal))
  const paidTotal = Number(order?.paidTotal ?? order?.totals?.paidTotal ?? 0)

  const balanceDue = Math.max(0, netTotal - paidTotal)

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
  const signedBalance = (() => {
    const v = round2(netTotal - paidTotal)
    return Math.abs(v) <= 0.01 ? 0 : v
  })()
  const signedBalanceLabel = signedBalance < -0.01 ? 'Fazla' : 'Kalan'
  const signedBalanceValue = signedBalance < -0.01 ? Math.abs(signedBalance) : signedBalance

  const openPaymentModal = async () => {
    try {
      const entityId = getOrderId(order)
      if (entityId && isValidObjectId(entityId)) {
        await api('/api/tenant/audit', {
          method: 'POST',
          data: { action: 'ödeme_modal_acildi', entityType: 'order', entityId, meta: {} }
        })
      }
    } catch {}
    setDiscountDraft(Number(order?.discountPercent || 0))
    setPaymentAmount(signedBalance > 0.01 ? String(signedBalance) : '')
    setPaymentNote('')
    setPayOpen(true)
  }

  const cashPaidTotal = (() => {
    const payments = Array.isArray(order?.payments) ? order.payments : []
    return payments
      .filter(p => String(p?.method || '') === 'cash')
      .reduce((sum, p) => sum + (Number(p?.amount) || 0), 0)
  })()
  const tenderedCash = paymentMethod === 'cash' ? (Number(paymentAmount) || 0) : 0
  const changeDue = (order?.settlementType === 'veresiye')
    ? 0
    : (paymentMethod === 'cash'
      ? Math.max(0, (cashPaidTotal + tenderedCash) - netTotal)
      : 0)

  const uiStatusLabels = {
    waiting: 'Bekliyor',
    preparing: 'Hazırlanıyor',
    ready: 'Hazır'
  }
  const uiStatusColors = {
    waiting: '#60a5fa',
    preparing: '#f59e0b',
    ready: '#22c55e'
  }

  const topbarStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 10px',
    height: 'auto',
    minHeight: 'unset',
    boxSizing: 'border-box'
  }

  if (!isOrderView) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="card" style={topbarStyle}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Aktif Masasız Satışlar</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={() => loadActiveOrders()} disabled={loadingList || busy}>Yenile</button>
            <button className="btn btn--primary" onClick={startWalkInOrder} disabled={busy || loadingList}>
              Yeni Sipariş
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {loadingList && <div className="card" style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
          {!loadingList && activeOrders.length === 0 && <div className="card" style={{ color: 'var(--muted)' }}>Aktif sipariş yok</div>}
          {activeOrders.map((o) => {
            const oid = getListOrderId(o)
            const ui = String(o?.uiStatus || '').trim() || (String(o?.status || '').trim() === 'sent' ? 'sent' : 'open')
            const label = ui === 'ready' ? 'Hazır' : ui === 'sent' ? 'Hazırlanıyor' : 'Bekliyor'
            const color = ui === 'ready' ? '#16a34a' : ui === 'sent' ? '#f97316' : '#6b7280'
            const borderColor = ui === 'ready' ? '#86efac' : ui === 'sent' ? '#fdba74' : '#e5e7eb'
            const customerName = String(o.customerName || '').trim() || 'Misafir'
            const title = `Masasız Satış — ${customerName} • ${o?.orderNo ? `Sipariş ${o.orderNo}` : 'Sipariş —'}`
            const totals = o?.totals || {}
            const netTotal = Number(totals.netTotal ?? totals.grandTotal ?? totals.total ?? o?.netTotal ?? o?.total ?? 0)
            const balanceDue = Number(totals.balanceDue ?? o?.balanceDue ?? 0)

            return (
              <div
                key={oid}
                className="card"
                onClick={() => nav(`/kermes/app/walkin/${oid}`)}
                style={{ cursor: 'pointer', display: 'grid', gap: 8, borderColor, position: 'relative' }}
              >
                <span className="page-pill" style={{ position: 'absolute', top: 10, left: 10, background: '#f3f4f6', borderColor: '#d1d5db', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  MASASIZ
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 800, lineHeight: 1.2 }}>{customerName}</div>
                  <span className="page-pill" style={{ color, borderColor: color }}>{label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{title}</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Toplam</div>
                    <div style={{ fontWeight: 800 }}>{netTotal.toFixed(2)} TL</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kalan</div>
                    <div style={{ fontWeight: 700, color: balanceDue > 0.01 ? '#b91c1c' : 'var(--text)' }}>{balanceDue.toFixed(2)} TL</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="pageShell" style={{ gap: 12 }}>
      <div className="card stickyTop" style={topbarStyle}>
        <button className="btn" onClick={() => nav('/kermes/app/walkin')}>← Geri</button>
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>
            <span>Masasız Satış —</span>
            <input
              className="input"
              value={customerNameDraft}
              placeholder="Misafir"
              onChange={(e) => setCustomerNameDraft(e.target.value)}
              onBlur={async () => {
                if (!getOrderId(order) || busy) return
                const next = String(customerNameDraft || '').trim() || 'Misafir'
                const current = String(order?.customerName || '').trim() || 'Misafir'
                if (next === current) {
                  setCustomerNameDraft(current)
                  return
                }
                await saveCustomerName(next)
              }}
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (!getOrderId(order) || busy) return
                const next = String(customerNameDraft || '').trim() || 'Misafir'
                await saveCustomerName(next)
              }}
              disabled={!getOrderId(order) || busy}
              style={{
                height: 28,
                padding: '4px 8px',
                fontSize: 12,
                maxWidth: 180,
                width: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              • {order?.orderNo ? `Sipariş ${order.orderNo}` : `Sipariş #${String(selectedOrderId).slice(-6)}`}
            </span>
          </div>
          {Math.abs(signedBalance) > 0.01 && (
            <span
              className="page-pill"
              style={{
                background: signedBalance < -0.01 ? '#fef2f2' : '#f3f4f6',
                borderColor: signedBalance < -0.01 ? '#fecaca' : '#d1d5db',
                color: signedBalance < -0.01 ? '#b91c1c' : '#374151'
              }}
            >
              {signedBalanceLabel}: {signedBalanceValue.toFixed(2)} TL
            </span>
          )}
        </div>
        <button
          className="btn btn--danger"
          onClick={closeSelectedOrder}
          disabled={!getOrderId(order) || busy}
        >
          Kapat
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: isMobilePortrait ? 'visible' : 'hidden' }}>
        <div className="saleStandard3Col" style={{ minHeight: 0 }}>
          <SaleCategorySidebar categories={categories} activeCategoryId={activeCategory} onSelect={setActiveCategory} />

          <div className="card salePanel">
            <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Ürünler</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} ürün</div>
            </div>
            {!order ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)' }}>Yükleniyor...</div>
            ) : (
              <div className="salePanelScroll" style={{ paddingTop: 10 }}>
                <div className="posItemsGrid">
                  {items.map(i => (
                  <ProductCard key={i.id} item={i} onClick={() => addItem(i.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={cartAnchorRef} className="card salePanel" style={{ minHeight: 0 }}>
              <div className="saleCartHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Sepet</h3>
                <div />
              </div>

              {error && <div style={{ color: '#ef4444', marginTop: 8 }}>{error}</div>}

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--xs btn--toggle" onClick={() => setCartViewMode('grouped')} disabled={busy} aria-pressed={cartViewMode === 'grouped'}>
                    ✓ Toplu
                  </button>
                  <button className="btn btn--xs btn--toggle" onClick={() => setCartViewMode('separate')} disabled={busy} aria-pressed={cartViewMode === 'separate'}>
                    Ayrı
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn--xs btn--toggle" onClick={() => setServingType('tray')} disabled={busy} aria-pressed={servingType === 'tray'}>
                    TEPSİDE
                  </button>
                  <button className="btn btn--xs btn--toggle" onClick={() => setServingType('plate')} disabled={busy} aria-pressed={servingType === 'plate'}>
                    TABAKTA
                  </button>
                  <button className="btn btn--xs btn--toggle" onClick={() => setServingType('package')} disabled={busy} aria-pressed={servingType === 'package'}>
                    PAKET
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Hazırlanacaklar’a Düşsün</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--toggle btn--xs"
                    aria-pressed={effectiveKitchenEnabled !== false}
                    onClick={() => setKitchenMode(true)}
                    disabled={busy || !getOrderId(order) || inflightRef.current.get(`${(selectedOrderId || getOrderId(order))}:kitchen-mode`)}
                  >
                    Açık
                  </button>
                  <button
                    type="button"
                    className="btn btn--toggle btn--xs"
                    aria-pressed={effectiveKitchenEnabled === false}
                    onClick={() => setKitchenMode(false)}
                    disabled={busy || !getOrderId(order) || inflightRef.current.get(`${(selectedOrderId || getOrderId(order))}:kitchen-mode`)}
                  >
                    Kapalı
                  </button>
                </div>
              </div>

              {order?.servingType && servingType !== order.servingType && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                  Seçim bir sonraki gönderimde geçerli
                </div>
              )}

              <div className="saleCartList" style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {(() => {
                  const raw = Array.isArray(order?.items) ? order.items : []
                  const openItems = raw.filter(it => it?.status === 'open')
                  const canShowPrep = effectiveKitchenEnabled !== false
                  const prepItems = raw.filter(it => it?.status === 'sent' || it?.status === 'preparing')
                  const sentItems = canShowPrep ? prepItems : []
                  const approvedItems = canShowPrep ? [] : prepItems
                  const otherItems = raw.filter(it => it?.status === 'completed' || it?.status === 'cancelled')

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

                  const openRender = cartViewMode === 'grouped'
                    ? Object.values(openItems.reduce((acc, it) => {
                      const k = `${String(it.menuItemId)}|${String(it.note || '')}|${String(it.status)}`
                      const prev = acc[k]
                      if (!prev) {
                        acc[k] = {
                          key: `g:${k}`,
                          menuItemId: it.menuItemId,
                          itemId: it._id,
                          itemIds: [it._id].filter(Boolean),
                          note: it.note || '',
                          qty: Number(it.qty) || 0,
                          subtotal: Number(it.subtotal) || 0,
                          repr: it
                        }
                      } else {
                        prev.qty += Number(it.qty) || 0
                        prev.subtotal += Number(it.subtotal) || 0
                        if (it._id) prev.itemIds.push(it._id)
                      }
                      return acc
                    }, {}))
                    : openItems.map((it, idx) => ({
                      key: it._id || `${it.menuItemId}-${idx}`,
                      menuItemId: it.menuItemId,
                      itemId: it._id,
                      itemIds: [it._id].filter(Boolean),
                      note: it.note || '',
                      qty: Number(it.qty) || 0,
                      subtotal: Number(it.subtotal) || 0,
                      repr: it
                    }))

                  const sentRender = cartViewMode === 'grouped'
                    ? Object.values(sentItems.reduce((acc, it) => {
                      const k = `${String(it.menuItemId)}|${String(it.note || '')}|${String(it.status)}`
                      const prev = acc[k]
                      if (!prev) {
                        acc[k] = {
                          key: `s:${k}`,
                          menuItemId: it.menuItemId,
                          itemId: it._id,
                          itemIds: [it._id].filter(Boolean),
                          note: it.note || '',
                          qty: Number(it.qty) || 0,
                          subtotal: Number(it.subtotal) || 0,
                          repr: it
                        }
                      } else {
                        prev.qty += Number(it.qty) || 0
                        prev.subtotal += Number(it.subtotal) || 0
                        if (it._id) prev.itemIds.push(it._id)
                      }
                      return acc
                    }, {}))
                    : sentItems.map((it, idx) => ({
                      key: it._id || `${it.menuItemId}-sent-${idx}`,
                      menuItemId: it.menuItemId,
                      itemId: it._id,
                      itemIds: [it._id].filter(Boolean),
                      note: it.note || '',
                      qty: Number(it.qty) || 0,
                      subtotal: Number(it.subtotal) || 0,
                      repr: it
                    }))

                  const approvedRender = cartViewMode === 'grouped'
                    ? Object.values(approvedItems.reduce((acc, it) => {
                      const k = `${String(it.menuItemId)}|${String(it.note || '')}|${String(it.status)}`
                      const prev = acc[k]
                      if (!prev) {
                        acc[k] = {
                          key: `a:${k}`,
                          menuItemId: it.menuItemId,
                          itemId: it._id,
                          itemIds: [it._id].filter(Boolean),
                          note: it.note || '',
                          qty: Number(it.qty) || 0,
                          subtotal: Number(it.subtotal) || 0,
                          repr: it
                        }
                      } else {
                        prev.qty += Number(it.qty) || 0
                        prev.subtotal += Number(it.subtotal) || 0
                        if (it._id) prev.itemIds.push(it._id)
                      }
                      return acc
                    }, {}))
                    : approvedItems.map((it, idx) => ({
                      key: it._id || `${it.menuItemId}-approved-${idx}`,
                      menuItemId: it.menuItemId,
                      itemId: it._id,
                      itemIds: [it._id].filter(Boolean),
                      note: it.note || '',
                      qty: Number(it.qty) || 0,
                      subtotal: Number(it.subtotal) || 0,
                      repr: it
                    }))

                  const setItemQtyByRow = async (row, nextQty) => {
                    const orderId = selectedOrderId || getOrderId(order)
                    if (!orderId) {
                      toast.error('Sipariş bulunamadı')
                      return
                    }
                    if (cartViewMode === 'grouped' && Array.isArray(row?.itemIds) && row.itemIds.length > 1) {
                      toast.info('Bu işlem için Ayrı moduna geç')
                      return
                    }
                    const itemId = row?.repr?.id || row?.repr?._id || row?.repr?.itemId || row?.itemId || null
                    if (!itemId) {
                      toast.error('Ürün bulunamadı')
                      return
                    }
                    const key = `${orderId}:${itemId}:qty`
                    if (isDebounced(key, 250)) return
                    const res = await withLock(key, () => safeAction(
                      (signal) => api(`/api/pos/orders/${orderId}/items/${itemId}/quantity`, { method: 'PUT', data: { quantity: nextQty }, signal, silent: true }),
                      { reload: false }
                    ))
                    const fresh = pickOrder(res)
                    if (fresh) setNote(fresh.note || '')
                  }

                  const renderLine = (row, opts = {}) => {
                    const it = row.repr
                    const isOpen = opts.type === 'open'
                    const isSent = opts.type === 'sent'
                    const isGrouped = opts.grouped === true
                    const isMultiGroup = isGrouped && Array.isArray(row.itemIds) && row.itemIds.length > 1
                    const disableBase = busy || !getOrderId(order)
                    const orderId = selectedOrderId || getOrderId(order)
                    const itemId = row?.repr?.id || row?.repr?._id || row?.repr?.itemId || row?.itemId || null
                    const qtyLockKey = orderId && itemId ? `${orderId}:${itemId}:qty` : null
                    const noteLockKey = orderId && itemId ? `${orderId}:${itemId}:note` : null
                    const cancelLockKey = orderId && itemId ? `${orderId}:${itemId}:cancel` : null
                    const isQtyLocked = !!(qtyLockKey && inflightRef.current.get(qtyLockKey))
                    const isNoteLocked = !!(noteLockKey && inflightRef.current.get(noteLockKey))
                    const isCancelLocked = !!(cancelLockKey && inflightRef.current.get(cancelLockKey))
                    return (
                      <div
                        key={row.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '8px 12px',
                          opacity: (it?.status === 'completed' || it?.status === 'cancelled') ? 0.6 : 1
                        }}
                      >
                        <div>
                          {it?.status === 'sent' && (
                            <span className="page-pill" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8', marginBottom: 4, display: 'inline-block' }}>
                              Hazırlanıyor
                            </span>
                          )}
                          {it?.status === 'completed' && (
                            <span className="page-pill" style={{ background: '#ecfdf5', borderColor: '#6ee7b7', color: '#047857', marginBottom: 4, display: 'inline-block' }}>
                              Hazır
                            </span>
                          )}
                          {it?.status === 'cancelled' && (
                            <span className="page-pill" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: 4, display: 'inline-block' }}>
                              İptal
                            </span>
                          )}
                          <div style={{ fontWeight: 600 }}>{it?.nameSnapshot}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{it?.priceSnapshot} TL • x{row.qty}</div>
                          {!!row.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{row.note}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {isOpen && (
                            <>
                              <button
                                className="btn"
                                onClick={() => {
                                  if (isMultiGroup) {
                                    toast.info('Bu işlem için Ayrı moduna geç')
                                    return
                                  }
                                  const currentQty = Number(row?.qty) || 0
                                  const nextQty = currentQty <= 1 ? 0 : currentQty - 1
                                  setItemQtyByRow(row, nextQty)
                                }}
                                disabled={disableBase || isMultiGroup || isQtyLocked}
                                title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}
                              >
                                -
                              </button>
                              <button
                                className="btn"
                                onClick={() => {
                                  if (isMultiGroup) {
                                    toast.info('Bu işlem için Ayrı moduna geç')
                                    return
                                  }
                                  const currentQty = Number(row?.qty) || 0
                                  const nextQty = currentQty + 1
                                  setItemQtyByRow(row, nextQty)
                                }}
                                disabled={disableBase || isMultiGroup || isQtyLocked}
                                title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}
                              >
                                +
                              </button>
                              <button
                                className="btn"
                                onClick={() => {
                                  if (isMultiGroup) {
                                    toast.info('Bu işlem için Ayrı moduna geç')
                                    return
                                  }
                                  openItemNoteModal(row.itemId, row.note)
                                }}
                                disabled={disableBase || isMultiGroup || isNoteLocked}
                                title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}
                              >
                                Not
                              </button>
                              {!isGrouped && (
                                <input
                                  type="number"
                                  min="1"
                                  className="input"
                                  style={{ width: 80 }}
                                  value={tempQty[row.key] ?? row.qty}
                                  onChange={(e) => setTempQty({ ...tempQty, [row.key]: Math.max(1, Number(e.target.value) || 1) })}
                                  onBlur={async (e) => {
                                    const nextQty = Math.max(1, Number(e.target.value) || 1)
                                    await setItemQtyByRow(row, nextQty)
                                  }}
                                  disabled={disableBase || isMultiGroup || isQtyLocked}
                                />
                              )}
                            </>
                          )}
                          {isSent && (
                            <>
                              <button
                                className="btn"
                                onClick={() => {
                                  if (isMultiGroup) {
                                    toast.info('Bu işlem için Ayrı moduna geç')
                                    return
                                  }
                                  openItemNoteModal(row.itemId, row.note)
                                }}
                                disabled={disableBase || isNoteLocked || isMultiGroup}
                                title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}
                              >
                                Not
                              </button>
                              <button
                                className="btn"
                                onClick={() => {
                                  if (isMultiGroup) {
                                    toast.info('Bu işlem için Ayrı moduna geç')
                                    return
                                  }
                                  setSelectedItemForCancel(row.itemId)
                                  setItemCancelConfirmOpen(true)
                                }}
                                disabled={disableBase || isCancelLocked || isMultiGroup}
                                title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}
                                style={{ backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' }}
                              >
                                İptal
                              </button>
                            </>
                          )}
                          <div style={{ fontWeight: 600 }}>{row.subtotal} TL</div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <>
                      {openRender.map(r => renderLine(r, { type: 'open', grouped: cartViewMode === 'grouped' }))}
                      {sentItems.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Hazırlanacaklar</div>
                      )}
                      {sentRender.map(r => renderLine(r, { type: 'sent', grouped: cartViewMode === 'grouped' }))}

                      {approvedItems.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Onaylanan Ürünler</div>
                      )}
                      {approvedRender.map(r => renderLine(r, { type: 'sent', grouped: cartViewMode === 'grouped' }))}
                      {otherItems.length > 0 && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Tamamlanan / İptal</div>}
                      {otherRender.map(r => renderLine(r, { type: 'other', grouped: cartViewMode === 'grouped' }))}
                    </>
                  )
                })()}
              </div>

              </div>

              {order && (
                <div className="saleCartFooter" style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <div style={{ color: signedBalance < -0.01 ? '#b91c1c' : undefined }}>{signedBalanceLabel}</div>
                    <div style={{ color: signedBalance < -0.01 ? '#b91c1c' : undefined }}>{signedBalanceValue.toFixed(2)} TL</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      onClick={sendKitchen}
                      disabled={
                        busy ||
                        !canSendToKitchen ||
                        !getOrderId(order) ||
                        (order.items || []).length === 0
                      }
                    >
                      {effectiveKitchenEnabled === false ? 'Onayla (Mutfak Kapalı)' : 'Mutfağa Gönder'}
                    </button>
                    <button
                      className="btn"
                      onClick={openPaymentModal}
                      disabled={!getOrderId(order)}
                    >Ödeme Al</button>
                    <button className="btn" onClick={() => setOrderCancelConfirmOpen(true)} disabled={order.paymentStatus === 'paid' || order.status === 'cancelled'}>İptal</button>

                    <button className="btn" onClick={printReceiptOneClick} disabled={!getOrderId(order) || printingReceipt}>Fiş Yazdır</button>
                    <a className="btn" href={`/kermes/app/pos/orders/${order.id}/receipt`}>Fişi Gör</a>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

    <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Ödeme Al">
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Masasız Satış — {order?.customerName || 'Misafir'} • {order?.orderNo ? `Sipariş ${order.orderNo}` : `Sipariş #${(order?.id || '').slice(-6)}`}
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

        {(order?.payments || []).length > 0 && (
          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Önceki Ödemeler</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {order.payments.map((p) => (
                <div key={p._id || p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'grid' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(p.createdAt || p.paidAt || Date.now()).toLocaleString()}</div>
                    <div style={{ fontWeight: 600 }}>{p.amount} TL • {trPaymentMethodLabel(p.method)}</div>
                    {!!p.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.note}</div>}
                  </div>
                  {canTakePayment && (
                    <button className="btn" onClick={() => deletePayment(p._id || p.id)} disabled={busy}>
                      Sil
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {order?.settlementType === 'veresiye' && (
          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontWeight: 600 }}>Ödendi (Veresiye)</div>
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
        {!!veresiyeBranchError && (
          <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ fontWeight: 700, color: '#b91c1c' }}>Şube seçimi gerekli</div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{veresiyeBranchError}</div>
          </div>
        )}
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
                  setCreateForm({ name: '', phone: '', note: '' })
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
        {!!veresiyeBranchError && (
          <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ fontWeight: 700, color: '#b91c1c' }}>Şube seçimi gerekli</div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{veresiyeBranchError}</div>
          </div>
        )}
        {!!createAccountError && (
          <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ fontWeight: 700, color: '#b91c1c' }}>{createAccountError}</div>
          </div>
        )}
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad Soyad (Zorunlu)</div>
          <input ref={createAccountNameRef} className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} disabled={busy} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
          <input ref={createAccountPhoneRef} className="input" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} disabled={busy} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
          <input className="input" value={createForm.note} onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} disabled={busy} />
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

    <InputModal
      open={noteModalOpen}
      onClose={() => setNoteModalOpen(false)}
      title="Ürün Notu"
      initialValue={itemNote}
      placeholder="Not giriniz..."
      onSubmit={submitItemNote}
    />
    <InputModal
      open={cancelModalOpen}
      onClose={() => setCancelModalOpen(false)}
      title="İptal Sebebi"
      initialValue=""
      placeholder="İptal sebebi..."
      onSubmit={submitItemCancel}
    />
    <ConfirmModal
      open={orderCancelConfirmOpen}
      onClose={() => setOrderCancelConfirmOpen(false)}
      title="Siparişi İptal Et?"
      description={
        order?.status === 'sent'
          ? 'Bu işlem sepetteki tüm ürünleri iptal eder. Geri alınamaz. Mutfakta hazırlanan ürünler de iptal edilir.'
          : 'Bu işlem sepetteki tüm ürünleri iptal eder. Geri alınamaz.'
      }
      confirmText="Evet, İptal Et"
      cancelText="Vazgeç"
      onConfirm={() => {
        setOrderCancelConfirmOpen(false)
        cancelOrder()
      }}
    />
    <ConfirmModal
      open={itemCancelConfirmOpen}
      onClose={() => setItemCancelConfirmOpen(false)}
      title="Ürünü İptal Et?"
      description="Bu ürünü iptal etmek istiyor musun?"
      confirmText="Evet, İptal Et"
      cancelText="Vazgeç"
      onConfirm={() => {
        setItemCancelConfirmOpen(false)
        setCancelModalOpen(true)
      }}
    />

    </div>
  )
}
