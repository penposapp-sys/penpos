import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import InputModal from '../components/InputModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { isValidObjectId } from '../lib/ids.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useSafeOrderActions } from '../lib/useSafeOrderActions.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import SaleCategorySidebar from '../components/SaleCategorySidebar.jsx'
import { trPaymentMethodLabel, trServingTypeLabel, trStatusLabel } from '../i18n/tr.js'
import ProductCard from '../components/ProductCard.jsx'
import { servingTypeToApi } from '../lib/servingType.js'
import { enqueueReceiptPrint } from '../lib/printingClient.js'

export default function PosPage() {
  const nav = useNavigate()
  const { user, allowedBranchIds } = useAuth()
  const { isMobilePortrait } = useResponsiveFlags()
  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canTakePayment = hasPerm('take_payment')
  const canCreateVeresiye = hasPerm('create_veresiye')
  const canViewAccounts = hasPerm('view_accounts')
  const canManageAccounts = hasPerm('manage_accounts')
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
  const [createForm, setCreateForm] = useState({ name: '', phone: '', note: '' })
  const [createAccountError, setCreateAccountError] = useState('')
  const createAccountNameRef = useRef(null)
  const createAccountPhoneRef = useRef(null)
  const [veresiyeAmount, setVeresiyeAmount] = useState('')
  const [veresiyeNote, setVeresiyeNote] = useState('')
  const [tableName, setTableName] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [emptyTables, setEmptyTables] = useState([])
  const [targetTableId, setTargetTableId] = useState('')
  const [mergedBadge, setMergedBadge] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitSelection, setSplitSelection] = useState({})
  const [splitTargetTableId, setSplitTargetTableId] = useState('')
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [selectedItemForNote, setSelectedItemForNote] = useState(null)
  const [itemNote, setItemNoteText] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedItemForCancel, setSelectedItemForCancel] = useState(null)
  const [orderCancelConfirmOpen, setOrderCancelConfirmOpen] = useState(false)
  const [itemCancelConfirmOpen, setItemCancelConfirmOpen] = useState(false)
  const [splitConfirmOpen, setSplitConfirmOpen] = useState(false)
  const [splitResult, setSplitResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState(false)
  const [tableId, setTableId] = useState(null)
  const [branchReady, setBranchReady] = useState(false)
  const branchReadyRef = useRef(false)
  const orderRef = useRef(null)
  const tableIdRef = useRef(null)
  const inflightRef = useRef(new Map())
  const lastClickRef = useRef(new Map())
  const [, setLockTick] = useState(0)

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

  const printReceiptOneClick = async () => {
    if (isDebounced('receipt_print', 2000)) return
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

  
  const setBranchReadySafe = (v) => {
    branchReadyRef.current = v
    setBranchReady(v)
  }

  const ensureBranchReady = () => {
    if (!branchReadyRef.current) {
      console.warn('[POS_BLOCKED] branch not ready')
      return false
    }
    return true
  }

  const isEmptyOrder = (o) => {
    if (!o) return false
    return (
      (Array.isArray(o.items) ? o.items.length : 0) === 0 &&
      (Array.isArray(o.payments) ? o.payments.length : 0) === 0 &&
      Number(o.discountPercent || 0) === 0 &&
      String(o.note || '').trim() === ''
    )
  }

  const [tempQty, setTempQty] = useState({})
  const [cartViewMode, setCartViewMode] = useState('grouped')
  const [servingType, setServingType] = useState('plate')

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
  const [payMethods, setPayMethods] = useState([])
  const pickOrder = (res) => res?.data?.order ?? res?.order ?? null
  const getOrderId = (o) => o?._id || o?.id || o?.orderId || null

  const { busy: actionBusy, safeAction, reloadOrder } = useSafeOrderActions({
    getOrderId: () => getOrderId(order),
    orderId: getOrderId(order),
    setOrder,
    pickOrder
  })

  useEffect(() => {
    setBusy(actionBusy)
  }, [actionBusy])
  useEffect(() => { loadCategories() }, [])
  useEffect(() => { if (activeCategory) loadItems(activeCategory) }, [activeCategory])

  const loadOrderById = async (id) => {
    try {
      const res = await api(`/api/pos/orders/${id}`)
      if (res?.success === false) {
        setOrder(null)
        setNote('')
        setMergedBadge(false)
        setError(res.message || 'Bu işlem için yetkiniz yok')
        return
      }
      const order = res?.order
      if (!order) {
        setOrder(null)
        setNote('')
        setMergedBadge(false)
        setError('Sipariş bulunamadı')
        return
      }
      setOrder(order)
      setNote(order.note || '')
      setMergedBadge((order.mergeSourceOrderIds || []).length > 0)
      setDiscountDraft(Number(order.discountPercent || 0))
      const due = Number(order.balanceDue ?? order.totals?.balanceDue ?? order.remainingBalance ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
      if (order.tableId) {
        const tablesRes = await api('/api/tenant/tables', { silent: true })
        if (tablesRes?.success === false) {
          setTableName('')
          setEmptyTables([])
          return
        }
        const tables = Array.isArray(tablesRes?.tables) ? tablesRes.tables : []
        const t = tables.find(x => x.id === order.tableId)
        setTableName(t?.name || '')
        setEmptyTables(tables.filter(x => x.status === 'empty'))
      } else {
        setTableName('')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const initTable = async (tId) => {
    setBranchReadySafe(false)
    setBusy(true)
    setError(null)

    try {
      const metaRes = await api(`/api/pos/tables/${tId}/meta`, { silent: true })
      if (!metaRes?.ok) {
        toast.error(metaRes?.data?.message || metaRes?.message || 'Masa bilgisi alınamadı')
        setError('table_meta_error')
        return
      }

      const meta = metaRes?.data?.data || metaRes?.data
      const tableBranchId = String(meta?.branchId || '')
      if (!tableBranchId) {
        toast.error('Masa şubesi alınamadı')
        setError('table_branch_missing')
        return
      }

      const allowed = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String) : []
      if (allowed.length > 0 && !allowed.includes(tableBranchId)) {
        toast.error('Bu masaya erişim yetkin yok (Şube uyuşmuyor)')
        setError('branch_mismatch')
        return
      }

      try {
        localStorage.setItem('selectedBranchId', tableBranchId)
      } catch {}
      await new Promise(r => setTimeout(r, 0))

      setBranchReadySafe(true)

      const orderRes = await api(`/api/pos/tables/${tId}/order`, { silent: true })

      if (!orderRes?.ok) {
        if (orderRes?.status === 403) {
          toast.error(orderRes?.data?.message || orderRes?.message || 'Invalid branch')
          setError('branch_forbidden')
          setBranchReadySafe(false)
          return
        }
        toast.error(orderRes?.data?.message || orderRes?.message || 'Sipariş bilgisi alınamadı')
        setError('order_load_failed')
        return
      }

      if (orderRes?.data?.hasActive && orderRes?.data?.orderId) {
        await loadOrderById(String(orderRes.data.orderId))
        return
      }

      const startRes = await api(`/api/pos/tables/${tId}/start`, { method: 'POST', silent: true })

      if (startRes?.ok) {
        const newOrderId = startRes?.data?.orderId || startRes?.data?.data?.orderId || null
        if (newOrderId) {
          await loadOrderById(String(newOrderId))
          return
        }
        toast.error('Sipariş başlatılamadı')
        setError('start_failed')
        return
      }

      if (startRes?.status === 403) {
        toast.error(startRes?.data?.message || startRes?.message || 'Invalid branch')
        setError('branch_forbidden')
        setBranchReadySafe(false)
        return
      }

      if (startRes?.status === 409) {
        const occupiedOrderId = startRes?.data?.details?.orderId || null
        if (occupiedOrderId) {
          toast.info('Masa dolu, mevcut sipariş açılıyor')
          await loadOrderById(String(occupiedOrderId))
          return
        }

        const retry = await api(`/api/pos/tables/${tId}/order`, { silent: true })
        if (retry?.ok && retry?.data?.hasActive && retry?.data?.orderId) {
          await loadOrderById(String(retry.data.orderId))
          return
        }

        toast.error('Masa dolu görünüyor ancak sipariş alınamadı.')
        setError('table_in_use')
        return
      }

      toast.error(startRes?.data?.message || startRes?.message || 'Sipariş başlatılamadı')
      setError('start_failed')
    } finally {
      setBusy(false)
    }
  }

  // We need to keep the old loadOrder logic for when we have an explicit orderId from URL?
  // The prompt says: "POS ekranı yalnızca yetkili şubede çalışır ... order ve start yalnızca META tarafından serbest bırakılır."
  // If URL has orderId, we still need to check branch permission?
  // Usually orderId implies we know the order. But we need to check if we can access it.
  // The prompt focuses on "PosPage init’te sıralama: İlk iş: GET /api/pos/tables/:tableId/meta".
  // This implies Table Flow.
  // If we have orderId, maybe we should fetch order, check its table, then check meta?
  // Let's stick to Table Flow as primary.
  
  // Re-writing initTable to use the new helpers and logic


  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search)
      const orderId = params.get('orderId')?.trim() || null
      const tableIdRaw = params.get('tableId')?.trim() || null

      if (orderId) {
        await loadOrderById(orderId)
        return
      }

      if (!tableIdRaw) return

      if (!isValidObjectId(tableIdRaw)) {
        toast.error('Geçersiz masa id')
        setError('invalid_table_id')
        return
      }

      setTableId(tableIdRaw)
      
      await initTable(tableIdRaw)
    }
    init()
  }, [])

  useEffect(() => {
    orderRef.current = order
  }, [order])

  useEffect(() => {
    tableIdRef.current = tableId || null
  }, [tableId])

  useEffect(() => {
    return () => {
      const tId = tableIdRef.current || orderRef.current?.tableId || null
      const o = orderRef.current
      if (!tId) return
      if (!isEmptyOrder(o)) return
      try {
        api(`/api/pos/tables/${tId}/abandon`, { method: 'PUT', data: {}, keepalive: true, silent: true })
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (!order) return
    const v = order?.servingType
    if (v === 'tray' || v === 'plate') {
      setServingType(v)
    }
  }, [order?.id, order?.servingType])
  useEffect(() => {
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

  const addItem = async (menuItemId) => {
    setError('')
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const lockKey = `${orderId}:${menuItemId}:add`
    if (isDebounced(lockKey, 200)) return
    const result = await withLock(lockKey, () => safeAction((signal) => api(`/api/pos/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ menuItemId }),
      signal,
      silent: true
    })))
    const fresh = pickOrder(result)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const removeItem = async (menuItemId) => {
    setError('')
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const result = await safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${menuItemId}`, { method: 'DELETE', signal, silent: true }))
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
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const key = `${orderId}:${selectedItemForNote}:note`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${selectedItemForNote}/note`, { method: 'PUT', data: { note: val }, signal, silent: true })))
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
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const key = `${orderId}:${selectedItemForCancel}:cancel`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${selectedItemForCancel}/cancel`, { method: 'PUT', signal, silent: true })))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
    setCancelModalOpen(false)
  }
  const saveNote = async () => {
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/note`, { method: 'PUT', body: JSON.stringify({ note }), signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const cancelOrder = async () => {
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/cancel`, { method: 'PUT', signal, silent: true }))
    if (res) toast.success('Sipariş iptal edildi')
  }

  const sendKitchen = async () => {
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }

    const apiServingType = servingTypeToApi(servingType)
    const payload = apiServingType ? { servingType: apiServingType } : {}
    await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/send`, { method: 'PUT', data: payload, signal, silent: true }),
      { reload: false }
    )
  }

  const payOrder = async () => {
    if (!canTakePayment) {
      toast.error('Ödeme alma yetkiniz yok')
      return
    }
    const amount = paymentAmount ? Number(paymentAmount) : 0
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ method: paymentMethod, amount, note: paymentNote }),
      signal,
      silent: true
    }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
      setPaymentNote('')
    }
  }

  const applyDiscount = async () => {
    if (!canTakePayment) {
      toast.error('İndirim yetkiniz yok')
      return
    }
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
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
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
    }
  }

  const deletePayment = async (paymentId) => {
    if (!canTakePayment) {
      toast.error('Ödeme silme yetkiniz yok')
      return
    }
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/payments/${paymentId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
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
    const due = Number(order?.balanceDue ?? order?.totals?.balanceDue ?? 0)
    setVeresiyeAmount(due > 0 ? String(due) : '')
    setVeresiyeNote('')
  }

  const submitVeresiye = async () => {
    if (!canCreateVeresiye) {
      toast.error('Veresiye yetkiniz yok')
      return
    }
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const amount = veresiyeAmount ? Number(veresiyeAmount) : 0
    const note = String(veresiyeNote || '')
    const accountId = selectedAccount?.id || selectedAccount?._id || null
    if (!accountId) {
      toast.error('Cari seçilmedi')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/veresiye`, { method: 'POST', body: JSON.stringify({ accountId, amount, note }), signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
      setVeresiyeOpen(false)
    }
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
    setCreateForm({ name: '', phone: '', note: '' })
    setCreateAccountError('')
  }

  const closeTable = async () => {
    try {
      const tableId = order?.tableId
      if (!tableId) {
        toast.error('Masa bulunamadı')
        return
      }
      const res = await safeAction(
        (signal) => api(`/api/pos/tables/${tableId}/close`, { method: 'PUT', signal, silent: true }),
        { reload: false }
      )
      if (res) {
        toast.success('Masa kapatıldı')
        nav('/kermes/app/tables', { replace: true })
      }
    } catch {}
  }

  const openTransfer = async () => {
    setError('')
    const res = await safeAction((signal) => api('/api/tenant/tables', { signal, silent: true }), { reload: false })
    const tables = res?.tables || []
    setEmptyTables(tables.filter(x => x.status === 'empty'))
    setTargetTableId('')
    setTransferOpen(true)
  }

  const submitTransfer = async () => {
    setError('')
    await safeAction((signal) => api(`/api/pos/orders/${order.id}/transfer`, { method: 'PUT', body: JSON.stringify({ targetTableId }), signal, silent: true }))
    const res = await safeAction((signal) => api('/api/tenant/tables', { signal, silent: true }), { reload: false })
    const tables = res?.tables || []
    const t = tables.find(x => x.id === targetTableId)
    setTableName(t?.name || '')
    setTransferOpen(false)
  }

  const openSplit = async () => {
    setError('')
    const res = await safeAction((signal) => api('/api/tenant/tables', { signal, silent: true }), { reload: false })
    const tables = res?.tables || []
    setEmptyTables(tables.filter(x => x.status === 'empty'))
    const initial = {}
    ;((order?.items) || []).forEach(it => { initial[it.menuItemId] = 0 })
    setSplitSelection(initial)
    setSplitTargetTableId('')
    setSplitOpen(true)
  }

  const submitSplit = async () => {
    setError('')
    const items = Object.entries(splitSelection)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => ({ menuItemId, qty }))
    if (items.length === 0) return setSplitOpen(false)
    const res = await safeAction((signal) => api(`/api/pos/orders/${order.id}/split`, { method: 'PUT', body: JSON.stringify({ items, targetTableId: splitTargetTableId || undefined }), signal, silent: true }))
    if (!res) return
    setSplitOpen(false)
    setSplitResult(res)
    setSplitConfirmOpen(true)
  }

  const handleSplitConfirm = () => {
    if (splitResult?.newOrderId) {
      window.location.assign(`/kermes/app/pos?orderId=${splitResult.newOrderId}`)
    }
    setSplitConfirmOpen(false)
  }

  const handleSplitCancel = async () => {
    await reloadOrder()
    setSplitConfirmOpen(false)
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
  const canCloseTable =
    !!order?.tableId &&
    (order?.paymentStatus === 'paid' || balanceDue <= 0.01) &&
    (order?.items || []).length > 0 &&
    (order?.items || []).every(it => it.status === 'completed' || it.status === 'cancelled')

  const itemCount = (Array.isArray(order?.items) ? order.items : []).reduce((sum, it) => sum + (Number(it?.qty) || 0), 0)

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
    setPaymentAmount(balanceDue > 0 ? String(balanceDue) : '')
    setPaymentNote('')
    setPayOpen(true)
  }

  const CartPanel = ({ inDrawer = false } = {}) => (
    <>
      <div className="saleCartHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Sepet</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {canCloseTable && (
            <button
              className="btn btn--danger"
              onClick={closeTable}
              disabled={busy}
            >
              Masa Kapat
            </button>
          )}
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Durum: {trStatusLabel(order?.status) || '-'}
            {(order?.remainingBalance !== undefined && order.remainingBalance <= 0.01 && (order.totals?.grandTotal || 0) > 0) && <span style={{ color: '#22c55e', marginLeft: 4 }}>• ÖDENDİ</span>}
          </div>
        </div>
      </div>
      {error && <div style={{ color: '#ef4444', marginTop: 8 }}>{error}</div>}

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          const sentItems = raw.filter(it => it?.status === 'sent')
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

          const setItemQtyByRow = async (row, nextQty) => {
            const orderId = getOrderId(order)
            if (!orderId) { toast.error('Sipariş bulunamadı'); return }

            const itemId = row?.repr?.id || row?.repr?._id || row?.repr?.itemId || row?.itemId || null
            if (!itemId) {
              toast.error('Ürün bulunamadı')
              return
            }

            if (cartViewMode === 'grouped' && Array.isArray(row?.itemIds) && row.itemIds.length > 1) {
              toast.info('Ayrı moda geç')
              return
            }

            const lockKey = `${orderId}:${itemId}:qty`
            if (isDebounced(lockKey, 250)) return

            const res = await withLock(lockKey, () => safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${itemId}/quantity`, {
              method: 'PUT',
              data: { quantity: nextQty },
              signal,
              silent: true
            })))
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
            const rowOrderId = getOrderId(order)
            const rowItemId = row?.repr?.id || row?.repr?._id || row?.repr?.itemId || row?.itemId || null
            const qtyLockKey = rowOrderId && rowItemId ? `${rowOrderId}:${rowItemId}:qty` : null
            const noteLockKey = rowOrderId && rowItemId ? `${rowOrderId}:${rowItemId}:note` : null
            const cancelLockKey = rowOrderId && rowItemId ? `${rowOrderId}:${rowItemId}:cancel` : null
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {isOpen && (
                    <>
                      <button
                        className="btn"
                        onClick={() => {
                          if (isMultiGroup) {
                            toast.info('Ayrı moda geç')
                            return
                          }
                          const currentQty = Number(row?.qty) || 0
                          const nextQty = currentQty <= 1 ? 0 : currentQty - 1
                          setItemQtyByRow(row, nextQty)
                        }}
                        disabled={disableBase || isQtyLocked || isMultiGroup}
                        title={isMultiGroup ? 'Ayrı moda geç' : undefined}
                      >
                        -
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          if (isMultiGroup) {
                            toast.info('Ayrı moda geç')
                            return
                          }
                          const currentQty = Number(row?.qty) || 0
                          const nextQty = currentQty + 1
                          setItemQtyByRow(row, nextQty)
                        }}
                        disabled={disableBase || isQtyLocked || isMultiGroup}
                        title={isMultiGroup ? 'Ayrı moda geç' : undefined}
                      >
                        +
                      </button>
                      <button className="btn" onClick={() => openItemNoteModal(row.itemId, row.note)} disabled={disableBase}>
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
                          disabled={disableBase || isQtyLocked || isMultiGroup}
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
                            toast.info('Not için Ayrı moduna geç')
                            return
                          }
                          openItemNoteModal(row.itemId, row.note)
                        }}
                        disabled={disableBase || isNoteLocked}
                        title={isMultiGroup ? 'Not için Ayrı moduna geç' : undefined}
                        style={isMultiGroup ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                      >
                        Not
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          if (isMultiGroup) {
                            toast.info('İptal için Ayrı moduna geç')
                            return
                          }
                          openItemCancelModal(row.itemId)
                        }}
                        disabled={disableBase || isCancelLocked}
                        title={isMultiGroup ? 'İptal için Ayrı moduna geç' : undefined}
                        style={{ backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca', ...(isMultiGroup ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                      >
                        İptal
                      </button>
                    </>
                  )}
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.subtotal} TL</div>
                </div>
              </div>
            )
          }

          const sentRender = cartViewMode === 'grouped'
            ? Object.values(sentItems.reduce((acc, it) => {
              const k = `${String(it.menuItemId)}|${String(it.note || '')}|${String(it.status)}`
              const prev = acc[k]
              if (!prev) {
                acc[k] = {
                  key: `gs:${k}`,
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

            return (
              <>
                {openRender.map(r => renderLine(r, { type: 'open', grouped: cartViewMode === 'grouped' }))}

                {sentItems.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Mutfağa Gönderilenler</div>
                )}
                {sentRender.map(r => renderLine(r, { type: 'sent', grouped: cartViewMode === 'grouped' }))}

                {otherItems.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Tamamlanan / İptal</div>
                )}
                {otherRender.map(r => renderLine(r, { type: 'other', grouped: cartViewMode === 'grouped' }))}
              </>
            )
          })()}
        </div>
      </div>

      {order && (
        <div className="saleCartFooter">
          <div style={{ display: 'grid', gap: 6 }}>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
              <textarea className="input" rows="3" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <div>Kalan</div>
              <div style={{ textAlign: 'right' }}>
                <div>{balanceDue.toFixed(2)} TL</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Brüt: {grossTotal.toFixed(2)} TL</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>İndirim: %{discountPercent || 0} ({discountTotal.toFixed(2)} TL)</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Net: {netTotal.toFixed(2)} TL</div>
                {paidTotal > 0 && (
                  <div style={{ fontSize: 12, color: '#22c55e' }}>Ödenen: {paidTotal.toFixed(2)} TL</div>
                )}
              </div>
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
                Mutfağa Gönder ({trServingTypeLabel(servingType) || '-'})
              </button>
              <button
                className="btn"
                onClick={openPaymentModal}
                disabled={!getOrderId(order)}
              >Ödeme Al</button>
              <button className="btn" onClick={() => setOrderCancelConfirmOpen(true)} disabled={(order?.paidTotal > 0) || order.status === 'cancelled'}>İptal</button>
              <button className="btn" onClick={openTransfer} disabled={!order.tableId || (order.status !== 'open' && order.status !== 'sent')}>Masa Taşı</button>
              <button className="btn" onClick={openSplit} disabled={(order.status !== 'open' && order.status !== 'sent') || (order.items || []).length === 0}>Fiş Böl</button>
              <button className="btn" onClick={printReceiptOneClick} disabled={!getOrderId(order) || printingReceipt}>Fiş Yazdır</button>
              <a className="btn" href={`/kermes/app/pos/orders/${order.id}/receipt`}>Fişi Gör</a>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="saleStandard3Col vhFit">
        <SaleCategorySidebar categories={categories} activeCategoryId={activeCategory} onSelect={setActiveCategory} />

        <div className="card salePanel">
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
            {tableName ? `Masa: ${tableName}` : 'Masasız Satış'}
            {order?.orderNo ? ` • Sipariş ${order.orderNo}` : ' • Sipariş —'}
            {order?.createdByName ? ` • Alan: ${order.createdByName}` : ''}
            {mergedBadge ? ' • Birleşik' : ''}
          </div>
          <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Ürünler</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} ürün</div>
          </div>
          <div className="salePanelScroll" style={{ paddingTop: 10 }}>
            <div className="posItemsGrid">
              {items.map(i => (
                <ProductCard key={i.id} item={i} onClick={() => addItem(i.id)} />
              ))}
            </div>
          </div>
        </div>

        <div className="card salePanel">
          <CartPanel />
        </div>
      </div>

    <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Ödeme Al">
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {tableName ? `Masa: ${tableName}` : 'Masasız'} • {order?.orderNo ? `Sipariş ${order.orderNo}` : 'Sipariş —'}
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


    <Modal open={splitOpen} onClose={() => setSplitOpen(false)} title="Fiş Böl">
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürünleri ayır</div>
        {(order?.items || []).map((it, index) => (
          <div key={it._id || `${it.menuItemId}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{it.nameSnapshot} • x{it.qty}</div>
            <input
              type="number"
              min="0"
              max={it.qty}
              className="input"
              style={{ width: 100 }}
              value={splitSelection[it.menuItemId] ?? 0}
              onChange={(e) => setSplitSelection({ ...splitSelection, [it.menuItemId]: Math.max(0, Math.min(it.qty, Number(e.target.value))) })}
            />
          </div>
        ))}
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Masaya Taşı (opsiyonel)</div>
          <select className="input" value={splitTargetTableId} onChange={(e) => setSplitTargetTableId(e.target.value)}>
            <option value="">Seçiniz</option>
            {emptyTables.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={submitSplit}>Onayla</button>
      </div>
    </Modal>
    <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Masa Taşı">
      <div style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Hedef Masa</div>
          <select className="input" value={targetTableId} onChange={(e) => setTargetTableId(e.target.value)}>
            <option value="">Seçiniz</option>
            {emptyTables.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={submitTransfer} disabled={!targetTableId}>Taşı</button>
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
    <ConfirmModal
      open={splitConfirmOpen}
      onClose={handleSplitCancel}
      title="Fiş Bölündü"
      description="Yeni fişe gitmek ister misiniz?"
      confirmText="Evet, Git"
      cancelText="Hayır, Kal"
      onConfirm={handleSplitConfirm}
    />
    </div>
  )
}
