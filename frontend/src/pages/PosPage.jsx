import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { startTransition, useCallback } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import InputModal from '../components/InputModal.jsx'
import ProductConfigModal from '../components/ProductConfigModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import SalesEntryDateButton from '../components/SalesEntryDateButton.jsx'
import { isValidObjectId } from '../lib/ids.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useBusinessSettings } from '../context/BusinessSettingsContext.jsx'
import { useSafeOrderActions } from '../lib/useSafeOrderActions.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import SaleCategorySidebar from '../components/SaleCategorySidebar.jsx'
import SalesProductGrid from '../components/SalesProductGrid.jsx'
import { trStatusLabel } from '../i18n/tr.js'
import ProductImage from '../components/ProductImage.jsx'
import { ServingType, normalizeServingType, servingTypeLabelTR } from '../utils/servingType.js'
import { enqueueReceiptPrint } from '../lib/printingClient.js'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { buildCartRows } from '../lib/cartItemRows.js'
import { getKitchenItemStatusMeta, isKitchenActiveItemStatus, isKitchenTerminalItemStatus } from '../lib/kitchenItemStatus.js'
import { isCashPaymentMethod, paymentMethodLabel, pickInitialPaymentMethod } from '../lib/paymentMethods.js'
import { requiresProductConfig } from '../lib/productPortions.js'
import { openReceiptPopup } from '../lib/receiptPopup.js'
import { readSalesEntryDate, todayYmd, writeSalesEntryDate } from '../lib/salesEntryDate.js'
import useVirtualProductGrid from '../hooks/useVirtualProductGrid.js'
import { diffPerfCounter, getPerfNow, incrementPerfCounter, isPerfDebugEnabled, logPerf, markPerfEnd, markPerfStart, snapshotPerfCounter } from '../lib/perfDebug.js'

export default function PosPage() {
  const perfDebugEnabled = isPerfDebugEnabled()
  const nav = useNavigate()
  const location = useLocation()
  const { user, allowedBranchIds } = useAuth()
  const { isMobilePortrait } = useResponsiveFlags()
  const canEditEntryDate = user?.role === 'tenant_admin'
  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canTakePayment = hasPerm('take_payment')
  const canCreateVeresiye = hasPerm('create_veresiye')
  const { getSetting } = useBusinessSettings()
  const creditAccountsDisabled = getSetting('general.disableCreditAccounts', false) === true
  const requireCancelReasonForProduct = getSetting('general.requireCancelReasonForProduct', false) === true
  const returnToOpenTablesAfterOrder = getSetting('order.returnToOpenTablesAfterOrder', false) === true
  const showProductImages = true
  const canViewAccounts = hasPerm('view_accounts')
  const canManageAccounts = hasPerm('manage_accounts')
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [order, setOrder] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [entryDate, setEntryDate] = useState(() => (canEditEntryDate ? readSalesEntryDate() : todayYmd()))
  const [savedEntryDate, setSavedEntryDate] = useState('')
  const [paymentEntryDate, setPaymentEntryDate] = useState(() => todayYmd())
  const [savingEntryDate, setSavingEntryDate] = useState(false)
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
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [orderNoteModalOpen, setOrderNoteModalOpen] = useState(false)
  const [selectedItemForNote, setSelectedItemForNote] = useState(null)
  const [itemNote, setItemNoteText] = useState('')
  const [orderNoteDraft, setOrderNoteDraft] = useState('')
  const [weightModalOpen, setWeightModalOpen] = useState(false)
  const [pendingWeightItem, setPendingWeightItem] = useState(null)
  const [weightModalValue, setWeightModalValue] = useState('')
  const [productConfigOpen, setProductConfigOpen] = useState(false)
  const [pendingConfigItem, setPendingConfigItem] = useState(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedItemForCancel, setSelectedItemForCancel] = useState(null)
  const [orderCancelConfirmOpen, setOrderCancelConfirmOpen] = useState(false)
  const [itemCancelConfirmOpen, setItemCancelConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState(false)
  const [tableId, setTableId] = useState(null)
  const [branchReady, setBranchReady] = useState(false)
  const branchReadyRef = useRef(false)
  const orderRef = useRef(null)
  const tableIdRef = useRef(null)
  const currentOrderIdRef = useRef(null)
  const optimisticItemSeqRef = useRef(0)
  const inflightRef = useRef(new Map())
  const lastClickRef = useRef(new Map())
  const [, setLockTick] = useState(0)
  const itemsApiCallCountRef = useRef(0)
  const categoryPerfRef = useRef(null)
  const cartRenderSnapshotRef = useRef({})
  const lastCartSignatureRef = useRef('')

  const qtyInputRefs = useRef(new Map())
  const activeQtyRowKeyRef = useRef(null)
  const activeQtySelectionRef = useRef({ start: null, end: null })

  const [qtyDraftByRow, setQtyDraftByRow] = useState(() => ({}))
  const qtyDraftByRowRef = useRef({})

  const qtyPendingRef = useRef(new Map())
  const qtyTimerRef = useRef(new Map())
  const qtyInflightRef = useRef(new Set())
  const qtyCooldownUntilRef = useRef(new Map())
  const qtyLastToastAtRef = useRef(new Map())

  incrementPerfCounter('pageRenders', 'PosPage')

  useEffect(() => {
    qtyDraftByRowRef.current = qtyDraftByRow || {}
  }, [qtyDraftByRow])

  useEffect(() => {
    if (!canEditEntryDate) setEntryDate(todayYmd())
  }, [canEditEntryDate])

  useEffect(() => {
    if (!canEditEntryDate) setPaymentEntryDate(todayYmd())
  }, [canEditEntryDate])

  const toEntryDateValue = (value) => {
    if (!value) return todayYmd()
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return todayYmd()
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const canSaveEntryDate = canEditEntryDate && Boolean(order?.tableId) && Boolean(order?.id || order?._id)
  const hasEntryDateChange = Boolean(savedEntryDate) && entryDate !== savedEntryDate

  const getQtyDraft = (rowKey, fallbackNumber = 1) => {
    const key = String(rowKey || '')
    if (!key) return String(fallbackNumber)
    const v = qtyDraftByRow?.[key]
    return (v === undefined || v === null) ? String(fallbackNumber) : String(v)
  }

  const onQtyInputChange = (rowKey, next) => {
    const key = String(rowKey || '')
    if (!key) return
    const cleaned = String(next ?? '').replace(/[^\d]/g, '')
    setQtyDraftByRow(prev => ({ ...(prev || {}), [key]: cleaned }))
  }

  const commitQtyDraft = (rowKey, orderId, itemId, fallbackNumber = 1, rawOverride) => {
    const key = String(rowKey || '')
    const oId = String(orderId || '')
    const iId = String(itemId || '')
    if (!key || !oId || !iId) return

    const raw = rawOverride !== undefined ? String(rawOverride) : String(qtyDraftByRowRef.current?.[key] ?? '')
    const n = raw === '' ? Number(fallbackNumber) : Number(raw || fallbackNumber)
    const qty = Number.isFinite(n) ? Math.max(1, Math.min(9999, Math.floor(n))) : Number(fallbackNumber)

    setQtyDraftByRow(prev => ({ ...(prev || {}), [key]: String(qty) }))
    scheduleQtyUpdate(oId, iId, key, qty, true)
  }

  const flushQtyUpdate = async (itemId) => {
    const id = String(itemId || '')
    if (!id) return
    if (qtyInflightRef.current.has(id)) return
    const pending = qtyPendingRef.current.get(id)
    if (!pending) return
    const cooldownUntil = qtyCooldownUntilRef.current.get(id) || 0
    if (Date.now() < cooldownUntil) return

    qtyInflightRef.current.add(id)
    setLockTick(t => t + 1)
    try {
      const res = await api(`/api/pos/orders/${pending.orderId}/items/${id}/quantity`, {
        method: 'PUT',
        data: { quantity: pending.quantity },
        silent: true,
        retryOn429: false
      })

      if (!res?.ok) {
        if (res?.status === 429) {
          const now = Date.now()
          qtyCooldownUntilRef.current.set(id, now + 2000)
          const lastToast = qtyLastToastAtRef.current.get(id) || 0
          if (now - lastToast > 1500) {
            qtyLastToastAtRef.current.set(id, now)
            toast.error('Çok fazla istek, 2 sn sonra tekrar dene')
          }
          setTimeout(() => flushQtyUpdate(id), 2100)
          return
        }
        toast.error(res?.message || 'İşlem başarısız')
        await reloadOrder().catch(() => {})
        return
      }

      const fresh = pickOrder(res)
      if (fresh) {
        setOrder(fresh)
        setNote(fresh.note || '')
      }

      qtyPendingRef.current.delete(id)
      if (pending.rowKey) {
        setQtyDraftByRow(prev => ({ ...(prev || {}), [pending.rowKey]: String(pending.quantity) }))
      }
    } finally {
      qtyInflightRef.current.delete(id)
      setLockTick(t => t + 1)
    }
  }

  const scheduleQtyUpdate = (orderId, itemId, rowKey, nextQty, flushNow = false) => {
    const oId = String(orderId || '')
    const iId = String(itemId || '')
    if (!oId || !iId) return

    if (rowKey) {
      setQtyDraftByRow(prev => ({ ...(prev || {}), [String(rowKey)]: String(nextQty) }))
    }
    qtyPendingRef.current.set(iId, { orderId: oId, quantity: nextQty, rowKey })

    const tPrev = qtyTimerRef.current.get(iId)
    if (tPrev) {
      clearTimeout(tPrev)
    }
    if (flushNow) {
      flushQtyUpdate(iId)
      return
    }
    const t = setTimeout(() => flushQtyUpdate(iId), 420)
    qtyTimerRef.current.set(iId, t)
  }

  const flushPendingOrderEdits = async () => {
    try {
      for (const timer of qtyTimerRef.current.values()) clearTimeout(timer)
      qtyTimerRef.current.clear()
    } catch {}

    const pendingIds = Array.from(qtyPendingRef.current.keys())
    for (const itemId of pendingIds) {
      await flushQtyUpdate(itemId)
    }

    await saveNote()
  }

  useEffect(() => {
    return () => {
      try {
        for (const t of qtyTimerRef.current.values()) {
          clearTimeout(t)
        }
      } catch {}
      try {
        qtyTimerRef.current.clear()
      } catch {}
      try {
        qtyPendingRef.current.clear()
      } catch {}
      try {
        qtyInflightRef.current.clear()
      } catch {}
    }
  }, [])

  useEffect(() => {
    const key = activeQtyRowKeyRef.current
    if (!key) return
    const el = qtyInputRefs.current.get(key)
    if (!el) return
    if (document.activeElement !== el) {
      el.focus()
    }
    const { start, end } = activeQtySelectionRef.current || {}
    if (typeof start === 'number' && typeof end === 'number') {
      try {
        el.setSelectionRange(start, end)
      } catch {}
    }
  }, [qtyDraftByRow])

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

  const [cartViewMode, setCartViewMode] = useState('grouped')
  const [servingType, setServingType] = useState(ServingType.PLATE)
  const cartActionLabel = (kind) => {
    if (kind === 'ready') return 'Hazır'
    if (kind === 'cancel') return 'İptal'
    return 'Not'
  }
  const servingTypeToggleLabel = (type) => {
    if (!isMobilePortrait) {
      if (type === ServingType.TRAY) return 'TEPSİ'
      if (type === ServingType.PLATE) return 'TABAK'
      if (type === ServingType.PACKAGE) return 'PAKET'
      return servingTypeLabelTR(type) || '-'
    }
    if (type === ServingType.TRAY) return 'TEPSİ'
    if (type === ServingType.PLATE) return 'TABAK'
    if (type === ServingType.PACKAGE) return 'PAKET'
    return servingTypeLabelTR(type) || '-'
  }

  const renderServingTypeDetail = (item, detailText, preferredServingType = null) => {
    const itemServingType = normalizeServingType(preferredServingType || item?.servingType || order?.servingType || servingType, { fallback: null })
    const servingLabel = itemServingType ? servingTypeLabelTR(itemServingType, { fallback: '' }) : ''
    return (
      <div className="sale-cart-line__detail-stack">
        <div className="sale-cart-line__detail-primary">{detailText}</div>
        {servingLabel ? (
          <div className="sale-cart-line__serving-note">
            <span className="sale-cart-line__serving-pill">Servis: {servingLabel}</span>
          </div>
        ) : null}
      </div>
    )
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
  const loadItems = async () => {
    itemsApiCallCountRef.current += 1
    logPerf('PosPage', 'menu-items-request', {
      requestCount: itemsApiCallCountRef.current,
      activeCategory: String(activeCategory || ''),
      reason: 'initial-load'
    })
    const res = await api('/api/tenant/menu-items?active=true')
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
  useEffect(() => { loadItems() }, [])

  const filteredItems = useMemo(() => {
    const activeId = String(activeCategory || '').trim()
    const nextItems = !activeId
      ? items
      : (items || []).filter((item) => String(item?.categoryId || '') === activeId)
    logPerf('PosPage', 'filter-result', {
      activeCategory: activeId,
      totalProducts: (items || []).length,
      filteredCount: nextItems.length
    })
    return nextItems
  }, [activeCategory, items])

  const handleCategorySelect = useCallback((categoryId) => {
    categoryPerfRef.current = {
      categoryId: String(categoryId || ''),
      startedAt: getPerfNow(),
      apiRequestCountBefore: itemsApiCallCountRef.current
    }
    markPerfStart('PosPage', 'category-change', {
      categoryId: String(categoryId || ''),
      previousCategoryId: String(activeCategory || '')
    })
    startTransition(() => {
      setActiveCategory(String(categoryId || ''))
    })
  }, [activeCategory])

  const loadOrderById = async (id) => {
    try {
      const res = await api(`/api/pos/orders/${id}`)
      if (res?.success === false) {
        setOrder(null)
        setNote('')
        setMergedBadge(false)
        setError(res.message || 'Bu işlem için yetkiniz yok')
        return null
      }
      const order = res?.order
      if (!order) {
        setOrder(null)
        setNote('')
        setMergedBadge(false)
        setError('Sipariş bulunamadı')
        return null
      }
      setOrder(order)
      setNote(order.note || '')
      setMergedBadge((order.mergeSourceOrderIds || []).length > 0)
      setDiscountDraft(Number(order.discountPercent || 0))
      if (canEditEntryDate) {
        const nextEntryDate = toEntryDateValue(order.createdAt)
        setEntryDate(nextEntryDate)
        setSavedEntryDate(nextEntryDate)
      }
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
      return order
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  const saveOrderEntryDate = async () => {
    const orderId = String(order?.id || order?._id || '').trim()
    if (!orderId || !canSaveEntryDate || !hasEntryDateChange) return
    setSavingEntryDate(true)
    try {
      const res = await api(`/api/pos/orders/${orderId}/entry-date`, {
        method: 'PUT',
        data: { entryDate },
        silent: true
      })
      if (!res?.ok) {
        toast.error(res?.message || 'Sipariş tarihi kaydedilemedi')
        return
      }
      const fresh = pickOrder(res)
      if (fresh) {
        setOrder(fresh)
        const nextEntryDate = toEntryDateValue(fresh.createdAt)
        setEntryDate(nextEntryDate)
        setSavedEntryDate(nextEntryDate)
      }
      toast.success('Sipariş tarihi kaydedildi')
    } finally {
      setSavingEntryDate(false)
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

      const startRes = await api(`/api/pos/tables/${tId}/start`, { method: 'POST', body: JSON.stringify({ entryDate }), silent: true })

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
    currentOrderIdRef.current = getOrderId(order)
  }, [order])

  const addOptimisticOrderItem = useCallback((menuItem) => {
    const product = (menuItem && typeof menuItem === 'object') ? menuItem : null
    const menuItemId = String(product?.id || product?.menuItemId || '')
    if (!menuItemId) return null
    const tempId = `tmp:${menuItemId}:${Date.now()}:${optimisticItemSeqRef.current++}`
    const unitPrice = Number(product?.price || 0)
    const nextServingType = normalizeServingType(product?.servingType || servingType || orderRef.current?.servingType, { fallback: null })
    setOrder((prev) => {
      if (!prev) return prev
      const nextItems = Array.isArray(prev.items) ? [...prev.items] : []
      nextItems.push({
        _id: tempId,
        id: tempId,
        itemId: tempId,
        menuItemId,
        nameSnapshot: String(product?.name || 'Ürün'),
        priceSnapshot: unitPrice,
        qty: 1,
        subtotal: unitPrice,
        status: 'open',
        note: '',
        isWeightBased: !!product?.isWeightBased,
        servingType: nextServingType
      })
      const prevGross = Number(prev?.total ?? prev?.totals?.total ?? prev?.totals?.grandTotal ?? 0)
      const prevDiscountPercent = Number(prev?.discountPercent ?? 0)
      const prevPaid = Number(prev?.paidTotal ?? prev?.totals?.paidTotal ?? 0)
      const nextGross = prevGross + unitPrice
      const nextDiscountTotal = Number(prev?.discountTotal ?? prev?.totals?.discountTotal ?? ((nextGross * prevDiscountPercent) / 100))
      const nextNet = Math.max(0, nextGross - nextDiscountTotal)
      return {
        ...prev,
        items: nextItems,
        total: nextGross,
        netTotal: nextNet,
        balanceDue: Math.max(0, nextNet - prevPaid),
        totals: {
          ...(prev?.totals || {}),
          total: nextGross,
          grandTotal: nextGross,
          netTotal: nextNet,
          paidTotal: prevPaid,
          balanceDue: Math.max(0, nextNet - prevPaid)
        }
      }
    })
    return tempId
  }, [servingType])

  const removeOptimisticOrderItem = useCallback((tempId) => {
    if (!tempId) return
    setOrder((prev) => {
      if (!prev) return prev
      const prevItems = Array.isArray(prev.items) ? prev.items : []
      const removed = prevItems.find((item) => String(item?._id || item?.id || item?.itemId || '') === String(tempId))
      if (!removed) return prev
      const unitPrice = Number(removed?.subtotal || 0)
      const nextItems = prevItems.filter((item) => String(item?._id || item?.id || item?.itemId || '') !== String(tempId))
      const prevGross = Number(prev?.total ?? prev?.totals?.total ?? prev?.totals?.grandTotal ?? 0)
      const prevDiscountPercent = Number(prev?.discountPercent ?? 0)
      const prevPaid = Number(prev?.paidTotal ?? prev?.totals?.paidTotal ?? 0)
      const nextGross = Math.max(0, prevGross - unitPrice)
      const nextDiscountTotal = Number(prev?.discountTotal ?? prev?.totals?.discountTotal ?? ((nextGross * prevDiscountPercent) / 100))
      const nextNet = Math.max(0, nextGross - nextDiscountTotal)
      return {
        ...prev,
        items: nextItems,
        total: nextGross,
        netTotal: nextNet,
        balanceDue: Math.max(0, nextNet - prevPaid),
        totals: {
          ...(prev?.totals || {}),
          total: nextGross,
          grandTotal: nextGross,
          netTotal: nextNet,
          paidTotal: prevPaid,
          balanceDue: Math.max(0, nextNet - prevPaid)
        }
      }
    })
  }, [])

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
      const allowed = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String).filter(Boolean) : []
      const selectedBranchId = (() => {
        try { return String(localStorage.getItem('selectedBranchId') || '').trim() } catch { return '' }
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
        setPaymentMethod((current) => pickInitialPaymentMethod(methods, current))
      } catch {}
    }
    loadPaymentSettings()
  }, [Array.isArray(allowedBranchIds) ? allowedBranchIds.join(',') : ''])

  const currentOrderId = getOrderId(order)

  const addItem = useCallback(async (menuItem) => {
    setError('')
    const orderId = currentOrderIdRef.current
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const menuItemId = typeof menuItem === 'object' && menuItem !== null ? menuItem.id : menuItem
    if (requiresProductConfig(menuItem)) {
      setPendingConfigItem(menuItem)
      setProductConfigOpen(true)
      return
    }
    const optimisticTempId = addOptimisticOrderItem(menuItem)
    const lockKey = `${orderId}:${menuItemId}:add`
    if (isDebounced(lockKey, 200)) return
    const result = await withLock(lockKey, () => api(`/api/pos/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ menuItemId }),
      silent: true
    }))
    if (!result?.ok) {
      const code = result?.data?.code || result?.code || result?.data?.error || result?.error || ''
      const message = String(result?.data?.message || result?.message || '')
      if (menuItem && (code === 'invalid_weight' || /gram/i.test(message))) {
        removeOptimisticOrderItem(optimisticTempId)
        setPendingWeightItem(menuItem)
        setWeightModalOpen(true)
        return
      }
      removeOptimisticOrderItem(optimisticTempId)
      toast.error(message || 'İşlem başarısız')
      return
    }
    const fresh = pickOrder(result?.data || result)
    if (fresh) {
      setOrder(fresh)
      setNote(fresh.note || '')
    }
  }, [addOptimisticOrderItem, removeOptimisticOrderItem])

  const submitConfiguredItem = async (payload) => {
    const orderId = currentOrderIdRef.current
    const menuItemId = String(payload?.menuItemId || '').trim()
    if (!orderId || !menuItemId) return false
    const lockKey = `${orderId}:${menuItemId}:add:${String(payload?.portionKey || 'full')}:${String(payload?.weightGrams || '')}`
    if (isDebounced(lockKey, 200)) return false
    const result = await withLock(lockKey, () => api(`/api/pos/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
      silent: true
    }))
    if (!result?.ok) {
      toast.error(result?.data?.message || result?.message || 'İşlem başarısız')
      return false
    }
    const fresh = pickOrder(result?.data || result)
    if (fresh) {
      setOrder(fresh)
      setNote(fresh.note || '')
      setPendingConfigItem(null)
      return true
    }
    return false
  }

  const {
    containerRef: productScrollRef,
    gridMeasureRef: productGridMeasureRef,
    cardMeasureRef: productCardMeasureRef,
    handleScroll: handleProductScroll,
    visibleItems: visibleMenuItems,
    topSpacer: topProductSpacer,
    bottomSpacer: bottomProductSpacer,
    isVirtualized: productsVirtualized,
    debugState: productGridDebug
  } = useVirtualProductGrid({
    items: filteredItems,
    enabled: isMobilePortrait,
    debugKey: 'PosPage',
    resetDeps: [activeCategory]
  })

  useEffect(() => {
    if (!perfDebugEnabled) return
    if (!categoryPerfRef.current) return
    const renderedDomCount = productScrollRef.current
      ? productScrollRef.current.querySelectorAll('.productCard').length
      : 0
    const elapsedMs = markPerfEnd('PosPage', 'category-change', {
      categoryId: String(activeCategory || ''),
      filteredCount: filteredItems.length,
      visibleCount: visibleMenuItems.length,
      renderedDomCount,
      apiRequestsDuringChange: itemsApiCallCountRef.current - Number(categoryPerfRef.current.apiRequestCountBefore || 0)
    })
    logPerf('PosPage', 'category-change-summary', {
      elapsedMs,
      activeCategory: String(activeCategory || ''),
      filteredCount: filteredItems.length,
      visibleCount: visibleMenuItems.length,
      renderedDomCount
    })
    categoryPerfRef.current = null
  }, [activeCategory, filteredItems.length, perfDebugEnabled, productScrollRef, visibleMenuItems.length])

  useEffect(() => {
    if (!isMobilePortrait || !perfDebugEnabled || !productGridDebug) return
    const frame = requestAnimationFrame(() => {
      const renderedDomCount = productScrollRef.current
        ? productScrollRef.current.querySelectorAll('.productCard').length
        : 0
      logPerf('PosPage', 'virtual-grid-dom', {
        ...productGridDebug,
        renderedDomCount
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [isMobilePortrait, perfDebugEnabled, productGridDebug, productScrollRef])

  useEffect(() => {
    if (!isMobilePortrait || !perfDebugEnabled || !productGridDebug) return
    const frame = requestAnimationFrame(() => {
      const renderedDomCount = productScrollRef.current
        ? productScrollRef.current.querySelectorAll('.productCard').length
        : 0
      logPerf('PosPage', 'virtual-grid-window', { ...productGridDebug, renderedDomCount })
    })
    return () => cancelAnimationFrame(frame)
  }, [isMobilePortrait, perfDebugEnabled, productGridDebug, productScrollRef, topProductSpacer, bottomProductSpacer])

  useEffect(() => {
    if (!perfDebugEnabled) return
    const nextSignature = JSON.stringify(
      Array.isArray(order?.items)
        ? order.items.map((item) => ({
            id: String(item?.menuItemId || item?.itemId || item?._id || ''),
            qty: Number(item?.qty || 0),
            status: String(item?.status || '')
          }))
        : []
    )
    if (!lastCartSignatureRef.current) {
      lastCartSignatureRef.current = nextSignature
      cartRenderSnapshotRef.current = snapshotPerfCounter('productCardRenders')
      return
    }
    if (lastCartSignatureRef.current === nextSignature) return
    const delta = diffPerfCounter('productCardRenders', cartRenderSnapshotRef.current)
    const visibleIds = new Set(visibleMenuItems.map((item) => String(item?.id || item?._id || '')))
    const affectedVisibleCards = delta.changed.filter((entry) => visibleIds.has(String(entry.key || '')))
    logPerf('PosPage', 'cart-change-rerenders', {
      visibleCardRerenderCount: affectedVisibleCards.length,
      visibleCardIds: affectedVisibleCards.map((entry) => entry.key),
      totalChangedCards: delta.changed.length
    })
    lastCartSignatureRef.current = nextSignature
    cartRenderSnapshotRef.current = delta.current
  }, [order?.items, perfDebugEnabled, visibleMenuItems])

  const openReceiptPreview = async () => {
    const orderId = getOrderId(order)
    if (!orderId) return
    try {
      await openReceiptPopup(orderId)
    } catch (err) {
      toast.error(err?.message || 'Fiş popup penceresi açılamadı')
    }
  }

  const submitWeightItem = async (value) => {
    const menuItem = pendingWeightItem
    const menuItemId = menuItem?.id || menuItem?.menuItemId || null
    const orderId = getOrderId(order)
    if (!orderId || !menuItemId) return false

    const grams = Math.round(Number(String(value || '').replace(',', '.')))
    if (!Number.isFinite(grams) || grams <= 0) {
      toast.error('Gram bilgisi geçersiz')
      return false
    }

    const isEdit = !!menuItem?.existingItemId
    const lockKey = isEdit ? `${orderId}:${menuItem.existingItemId}:weight:${grams}` : `${orderId}:${menuItemId}:add:${grams}`
    if (isDebounced(lockKey, 200)) return false
    const result = await withLock(lockKey, () => safeAction((signal) => api(
      isEdit ? `/api/pos/orders/${orderId}/items/${menuItem.existingItemId}/weight` : `/api/pos/orders/${orderId}/items`,
      {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(isEdit ? { weightGrams: grams } : { menuItemId, weightGrams: grams }),
        signal,
        silent: true
      }
    ), { reload: false }))
    const fresh = pickOrder(result)
    if (fresh) {
      setNote(fresh.note || '')
      setPendingWeightItem(null)
      setWeightModalValue('')
      return true
    }
    return false
  }

  const openWeightEditor = (item) => {
    if (!item) return
    setPendingWeightItem({
      id: item.menuItemId || item.id,
      menuItemId: item.menuItemId || item.id,
      existingItemId: item.itemId || item._id || null
    })
    setWeightModalValue(String(Number(item.weightGrams) || ''))
    setWeightModalOpen(true)
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
    const reason = String(val || '').trim()
    if (requireCancelReasonForProduct && !reason) {
      toast.error('İptal nedeni zorunlu')
      return false
    }
    const key = `${orderId}:${selectedItemForCancel}:cancel`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${selectedItemForCancel}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }), signal, silent: true })))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
    setCancelModalOpen(false)
  }
  const completeItem = async (itemId) => {
    if (!itemId) return
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const key = `${orderId}:${itemId}:complete`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction((signal) => api(`/api/pos/orders/${orderId}/items/${itemId}/complete`, { method: 'PUT', signal, silent: true })))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }
  const saveNote = async (nextNote = note) => {
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/note`, { method: 'PUT', body: JSON.stringify({ note: nextNote }), signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      return true
    }
    return false
  }

  const openOrderNoteModal = () => {
    setOrderNoteDraft(String(note || ''))
    setOrderNoteModalOpen(true)
  }

  const submitOrderNote = async () => {
    const ok = await saveNote(orderNoteDraft)
    if (ok) {
      setOrderNoteModalOpen(false)
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

    await flushPendingOrderEdits()

    const payload = { servingType: normalizeServingType(servingType) }
    const result = await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/send`, { method: 'PUT', data: payload, signal, silent: true }),
      { reload: false }
    )
    if (result && returnToOpenTablesAfterOrder && order?.tableId) {
      nav('/kermes/app/tables')
    }
  }

  const payOrder = async () => {
    if (!canTakePayment) {
      toast.error('Ödeme alma yetkiniz yok')
      return
    }
    if (!String(paymentMethod || '').trim()) {
      toast.error('Odeme yontemi secin')
      return
    }
    const amount = paymentAmount ? Number(paymentAmount) : 0
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const paymentAllocations = splitSelectedRows.reduce((acc, row) => {
      const itemId = String(row?.itemId || row?.repr?._id || row?.repr?.id || '')
      if (!itemId) return acc
      const current = acc.get(itemId) || {
        itemId,
        menuItemId: String(row?.menuItemId || row?.repr?.menuItemId || ''),
        qty: 0,
        subtotal: 0
      }
      current.qty += 1
      current.subtotal += Number(row?.subtotal || row?.repr?.subtotal || 0) || 0
      acc.set(itemId, current)
      return acc
    }, new Map())
    const itemAllocations = Array.from(paymentAllocations.values())
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ method: paymentMethod, amount, note: paymentNote, itemAllocations, entryDate: paymentEntryDate }),
      signal,
      silent: true
    }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
      setPaymentNote('')
      setSplitSelection({})
      setSplitOpen(false)
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

  const deleteDiscount = async () => {
    setDiscountDraft(0)
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/discount`, {
      method: 'PUT',
      body: JSON.stringify({ discountPercent: 0 }),
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
    if (!canCreateVeresiye || creditAccountsDisabled) {
      toast.error(creditAccountsDisabled ? 'Cari hesap özelliği kapalı' : 'Veresiye yetkiniz yok')
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
    if (!canCreateVeresiye || creditAccountsDisabled) {
      toast.error(creditAccountsDisabled ? 'Cari hesap özelliği kapalı' : 'Veresiye yetkiniz yok')
      return
    }
    const orderId = getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const rawAmount = String(veresiyeAmount || '').trim()
    const parsedAmount = rawAmount ? Number(rawAmount) : NaN
    const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined
    const note = String(veresiyeNote || '')
    const accountId = selectedAccount?.id || selectedAccount?._id || null
    if (!accountId) {
      toast.error('Cari seçilmedi')
      return
    }
    const payload = { accountId, note }
    if (amount !== undefined) payload.amount = amount
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/veresiye`, { method: 'POST', body: JSON.stringify(payload), signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
      setVeresiyeOpen(false)
    }
  }

  const deleteVeresiyeEntry = async (entryId) => {
    const orderId = getOrderId(order)
    if (!orderId || !entryId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/veresiye/${entryId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
    }
  }

  const deleteCollection = async (txId) => {
    const orderId = getOrderId(order)
    if (!orderId || !txId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${orderId}/collections/${txId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
      const due = Number(fresh.balanceDue ?? fresh.totals?.balanceDue ?? 0)
      setPaymentAmount(due > 0 ? String(due) : '')
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

  const backToTables = () => {
    nav('/kermes/app/tables')
  }

  const openTransfer = async () => {
    setError('')
    const { params } = buildBranchQueryParams(allowedBranchIds)
    const url = params ? `/api/tenant/tables?${params.toString()}` : '/api/tenant/tables'
    const res = await safeAction((signal) => api(url, { signal, silent: true, skipBranchHeader: true }), { reload: false })
    const tables = res?.tables || []
    setEmptyTables(tables.filter(x => x.status === 'empty'))
    setTargetTableId('')
    setTransferOpen(true)
  }

  const submitTransfer = async () => {
    setError('')
    await safeAction((signal) => api(`/api/pos/orders/${order.id}/transfer`, { method: 'PUT', body: JSON.stringify({ targetTableId }), signal, silent: true }))
    const { params } = buildBranchQueryParams(allowedBranchIds)
    const url = params ? `/api/tenant/tables?${params.toString()}` : '/api/tenant/tables'
    const res = await safeAction((signal) => api(url, { signal, silent: true, skipBranchHeader: true }), { reload: false })
    const tables = res?.tables || []
    const t = tables.find(x => x.id === targetTableId)
    setTableName(t?.name || '')
    setTransferOpen(false)
  }

  const openSplit = async () => {
    setError('')
    const initial = {}
    payableSplitRows.forEach((row) => {
      initial[row.key] = false
    })
    setSplitSelection(initial)
    setSplitOpen(true)
  }

  const submitSplit = async () => {
    if (splitSelectedRows.length === 0) {
      toast.error('En az bir ürün seçin')
      return
    }
    setSplitOpen(false)
    setPaymentAmount(splitSelectedAmount > 0 ? String(splitSelectedAmount) : '')
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
  const splitRows = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : []
    return buildCartRows(
      items.filter((item) => item && item.status !== 'cancelled' && Number(item?.qty || 0) > 0),
      'separate',
      'split'
    )
  }, [order?.items])
  const paidSplitUnitCounts = useMemo(() => {
    const counts = new Map()
    const payments = Array.isArray(order?.payments) ? order.payments : []
    for (const payment of payments) {
      const allocations = Array.isArray(payment?.itemAllocations) ? payment.itemAllocations : []
      for (const allocation of allocations) {
        const itemId = String(allocation?.itemId || '').trim()
        const qty = Math.max(0, Math.floor(Number(allocation?.qty || 0)))
        if (!itemId || qty <= 0) continue
        counts.set(itemId, (counts.get(itemId) || 0) + qty)
      }
    }
    return counts
  }, [order?.payments])
  const payableSplitRows = useMemo(() => {
    const usedCounts = new Map()
    return splitRows.filter((row) => {
      const itemId = String(row?.itemId || row?.repr?._id || row?.repr?.id || '').trim()
      if (!itemId) return true
      const alreadyPaidQty = paidSplitUnitCounts.get(itemId) || 0
      const seenQty = usedCounts.get(itemId) || 0
      usedCounts.set(itemId, seenQty + 1)
      return seenQty >= alreadyPaidQty
    })
  }, [splitRows, paidSplitUnitCounts])
  const splitSelectedRows = useMemo(
    () => payableSplitRows.filter((row) => splitSelection?.[row.key] === true),
    [payableSplitRows, splitSelection]
  )
  const splitSelectedSubtotal = useMemo(
    () => splitSelectedRows.reduce((sum, row) => sum + (Number(row?.subtotal || row?.repr?.subtotal || 0) || 0), 0),
    [splitSelectedRows]
  )
  const splitSelectedAmount = useMemo(() => {
    const subtotal = Math.max(0, splitSelectedSubtotal)
    const discount = Math.max(0, Math.min(100, Number(discountPercent || 0)))
    const net = subtotal - ((subtotal * discount) / 100)
    return Math.max(0, Math.round(net * 100) / 100)
  }, [splitSelectedSubtotal, discountPercent])
  const canSplitOrder = !!order && (order.status === 'open' || order.status === 'sent') && payableSplitRows.length > 0 && signedBalance > 0.01

  const selectedPaymentMethod = payMethods.find((method) => String(method?.key || method?.id || '') === String(paymentMethod || '')) || null
  const selectedPaymentIsCash = isCashPaymentMethod(selectedPaymentMethod || paymentMethod)
  const cashPaidTotal = (() => {
    const payments = Array.isArray(order?.payments) ? order.payments : []
    return payments
      .filter((payment) => isCashPaymentMethod(payment))
      .reduce((sum, p) => sum + (Number(p?.amount) || 0), 0)
  })()
  const tenderedCash = selectedPaymentIsCash ? (Number(paymentAmount) || 0) : 0
  const changeDue = (order?.settlementType === 'veresiye')
    ? 0
    : (selectedPaymentIsCash
      ? Math.max(0, (cashPaidTotal + tenderedCash) - netTotal)
      : 0)
  const canCloseTable =
    !!order?.tableId &&
    (order?.paymentStatus === 'paid' || balanceDue <= 0.01) &&
    (order?.items || []).length > 0 &&
    (order?.items || []).every(it => it.status === 'completed' || it.status === 'cancelled')

  const itemCount = (Array.isArray(order?.items) ? order.items : []).reduce((sum, it) => sum + (Number(it?.qty) || 0), 0)

  const previousLines = useMemo(() => {
    const out = []
    if (discountTotal > 0) {
      out.push({
        kind: 'discount',
        id: `discount:${String(order?.id || order?._id || '')}`,
        createdAt: order?.updatedAt || order?.createdAt || null,
        amount: discountTotal,
        label: 'İndirim',
        note: discountPercent > 0 ? `%${discountPercent} indirim uygulandı` : '',
        accountName: '',
        canDelete: !!canTakePayment
      })
    }
    const payments = Array.isArray(order?.payments) ? order.payments : []
    for (const p of payments) {
      out.push({
        kind: 'payment',
        id: String(p?._id || p?.id || ''),
        createdAt: p?.createdAt || p?.paidAt || null,
        amount: Number(p?.amount || 0) || 0,
        label: paymentMethodLabel(p),
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
  }, [order?.id, order?._id, order?.updatedAt, order?.createdAt, order?.payments, order?.veresiyeEntries, order?.linkedCollections, canTakePayment, canCreateVeresiye, discountTotal, discountPercent])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('pay') !== '1' || !getOrderId(order) || payOpen) return
    setDiscountDraft(Number(order?.discountPercent || 0))
    setPaymentAmount(signedBalance > 0.01 ? String(signedBalance) : '')
    setPaymentNote('')
    setPaymentEntryDate(todayYmd())
    setPayOpen(true)
    params.delete('pay')
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [order, payOpen, signedBalance])

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
    setSplitOpen(false)
    setSplitSelection({})
    setPayOpen(true)
  }

  const CartPanel = ({ inDrawer = false } = {}) => (
    <div className={`saleCartPanelContent${inDrawer ? ' saleCartPanelContent--drawer' : ''}`}>
      <div className="saleCartHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Sepet</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {canCloseTable && (
            <button
              className="btn btn--danger btn--close-action"
              onClick={closeTable}
              disabled={busy}
            >
              Masa Kapat
            </button>
          )}
          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>
              Durum: {trStatusLabel(order?.status) || '-'}
              {(order?.remainingBalance !== undefined && order.remainingBalance <= 0.01 && (order.totals?.grandTotal || 0) > 0) && <span style={{ color: '#22c55e', marginLeft: 4 }}>• ÖDENDİ</span>}
            </span>
            {canEditEntryDate ? (
              <SalesEntryDateButton
                value={entryDate}
                onChange={(value) => setEntryDate(writeSalesEntryDate(value))}
                title="Sipariş tarihini seç"
              />
            ) : null}
            {canSaveEntryDate && hasEntryDateChange ? (
              <button
                type="button"
                className="btn btn--xs"
                onClick={saveOrderEntryDate}
                disabled={savingEntryDate || busy}
              >
                {savingEntryDate ? '...' : 'Kaydet'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {error && <div style={{ color: '#ef4444', marginTop: 8 }}>{error}</div>}

      <div className="saleCartModeRow" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="saleCartModeRowInner">
          <div className="saleCartModeGroup saleCartModeGroup--compact">
            <button className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setCartViewMode('grouped')} disabled={busy} aria-pressed={cartViewMode === 'grouped'}>
              Toplu
            </button>
            <button className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setCartViewMode('separate')} disabled={busy} aria-pressed={cartViewMode === 'separate'}>
              Ayrı
            </button>
          </div>
          <div className="saleCartModeDivider" aria-hidden="true" />
          <div className="saleCartModeGroup saleCartModeGroup--service">
            <button className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setServingType(ServingType.TRAY)} disabled={busy} aria-pressed={servingType === ServingType.TRAY}>
              {servingTypeToggleLabel(ServingType.TRAY)}
            </button>
            <button className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setServingType(ServingType.PLATE)} disabled={busy} aria-pressed={servingType === ServingType.PLATE}>
              {servingTypeToggleLabel(ServingType.PLATE)}
            </button>
            <button className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setServingType(ServingType.PACKAGE)} disabled={busy} aria-pressed={servingType === ServingType.PACKAGE}>
              {servingTypeToggleLabel(ServingType.PACKAGE)}
            </button>
          </div>
        </div>
      </div>

      {order?.servingType && servingType !== order.servingType && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
          Seçim bir sonraki gönderimde geçerli
        </div>
      )}

      {canSendToKitchen && (
        <div className="saleCartMobileActionBar">
          <button
            className="btn saleCartMobileActionBtn"
            onClick={sendKitchen}
            disabled={
              busy ||
              !canSendToKitchen ||
              !getOrderId(order) ||
              (order.items || []).length === 0
            }
          >
            Mutfağa Gönder ({servingTypeLabelTR(servingType) || '-'})
          </button>
        </div>
      )}

      <div className="saleCartList saleCartList--offset order-cart-scroll scrollbar-hidden">
        <div style={{ display: 'grid', gap: 8 }}>
          {(() => {
            const raw = Array.isArray(order?.items) ? order.items : []
          const openItems = raw.filter(it => it?.status === 'open')
          const sentItems = raw.filter(it => isKitchenActiveItemStatus(it?.status))
          const otherItems = raw.filter(it => isKitchenTerminalItemStatus(it?.status))

          const otherRender = buildCartRows(otherItems, cartViewMode, 'o')
          const openRender = buildCartRows(openItems, cartViewMode, 'g')

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

            scheduleQtyUpdate(orderId, itemId, row.key, nextQty)
          }

          const renderLine = (row, opts = {}) => {
            const it = row.repr
            const isOpen = opts.type === 'open'
            const isSent = opts.type === 'sent'
            const isTerminal = opts.type === 'other'
            const isCompleted = isTerminal && String(it?.status || '') === 'completed'
            const isGrouped = opts.grouped === true
            const isMultiGroup = isGrouped && Array.isArray(row.itemIds) && row.itemIds.length > 1
            const isWeightBased = !!it?.isWeightBased
            const weightGrams = Number(it?.weightGrams) || 0
            const disableBase = busy || !getOrderId(order)
            const rowOrderId = getOrderId(order)
            const rowItemId = row?.repr?.id || row?.repr?._id || row?.repr?.itemId || row?.itemId || null
            const qtyLockKey = rowOrderId && rowItemId ? `${rowOrderId}:${rowItemId}:qty` : null
            const noteLockKey = rowOrderId && rowItemId ? `${rowOrderId}:${rowItemId}:note` : null
            const cancelLockKey = rowOrderId && rowItemId ? `${rowOrderId}:${rowItemId}:cancel` : null
            const completeLockKey = rowOrderId && rowItemId ? `${rowOrderId}:${rowItemId}:complete` : null
            const isQtyLocked = !!(qtyLockKey && inflightRef.current.get(qtyLockKey)) || qtyInflightRef.current.has(String(rowItemId || '')) || (qtyCooldownUntilRef.current.get(String(rowItemId || '')) || 0) > Date.now()
            const isNoteLocked = !!(noteLockKey && inflightRef.current.get(noteLockKey))
            const isCancelLocked = !!(cancelLockKey && inflightRef.current.get(cancelLockKey))
            const isCompleteLocked = !!(completeLockKey && inflightRef.current.get(completeLockKey))
            const rawDraft = getQtyDraft(row.key, row.qty)
            const parsedDraft = rawDraft === '' ? NaN : Number(rawDraft)
            const displayQty = Number.isFinite(parsedDraft) ? Math.max(0, Math.floor(parsedDraft)) : row.qty
            const unitPrice = Number(it?.priceSnapshot ?? (displayQty > 0 ? row.subtotal / displayQty : row.subtotal) ?? 0)
            const detailText = isWeightBased
              ? `${unitPrice} TL/KG • ${weightGrams} gr`
              : `${unitPrice} TL • x${displayQty}`
            const statusMeta = getKitchenItemStatusMeta(it?.status, { compact: true })
              return (
                <div
                  key={row.key}
                  className={`sale-cart-line${isTerminal ? ' sale-cart-line--terminal' : ''}${isCompleted ? ' sale-cart-line--terminal-has-actions' : ''}`}
                >
                  <div
                    onClick={() => {
                      if (isOpen && isWeightBased && !isMultiGroup) openWeightEditor({ ...it, itemId: rowItemId })
                    }}
                    className="sale-cart-line__info"
                    style={{ ...(isOpen && isWeightBased && !isMultiGroup ? { cursor: 'pointer' } : {}) }}
                  >
                    <div className="sale-cart-line__title">{it?.nameSnapshot}</div>
                  </div>
                  <div className="sale-cart-line__meta">
                    {statusMeta && (
                      <span className={`page-pill sale-cart-line-status${it?.status === 'open' ? ' sale-cart-line-status--open-dark' : ''}`} style={{ background: statusMeta.bg, borderColor: statusMeta.border, color: statusMeta.color }}>
                        {statusMeta.label}
                      </span>
                    )}
                  </div>
                <div className="sale-cart-line__detail">{renderServingTypeDetail(it, detailText, isOpen ? servingType : null)}</div>
                <div className="sale-cart-line__actions">
                  {isOpen && (
                    <>
                      <button
                        className="btn sale-cart-line__action-btn"
                        onClick={() => {
                          if (isMultiGroup) {
                            toast.info('Ayrı moda geç')
                            return
                          }
                          if (isWeightBased) {
                            removeItem(rowItemId)
                            return
                          }
                          const currentQty = Number(displayQty) || 0
                          const nextQty = currentQty <= 1 ? 0 : currentQty - 1
                          setItemQtyByRow(row, nextQty)
                        }}
                        disabled={disableBase || isQtyLocked || isMultiGroup}
                        title={isMultiGroup ? 'Ayrı moda geç' : undefined}
                      >
                        -
                      </button>
                      <button
                        className="btn sale-cart-line__action-btn"
                        onClick={() => {
                          if (isMultiGroup) {
                            toast.info('Ayrı moda geç')
                            return
                          }
                          if (isWeightBased) {
                            openWeightEditor({ ...it, itemId: rowItemId })
                            return
                          }
                          const currentQty = Number(displayQty) || 0
                          const nextQty = currentQty + 1
                          setItemQtyByRow(row, nextQty)
                        }}
                        disabled={disableBase || isQtyLocked || isMultiGroup}
                        title={isMultiGroup ? 'Ayrı moda geç' : undefined}
                      >
                        +
                      </button>
                      <button className="btn sale-cart-line__action-btn sale-cart-line__action-btn--note" onClick={() => openItemNoteModal(row.itemId, row.note)} disabled={disableBase}>
                        {cartActionLabel('note')}
                      </button>
                      {!isGrouped && (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="1"
                          className="input"
                          style={{ width: 80 }}
                          value={getQtyDraft(row.key, row.qty)}
                          onChange={(e) => onQtyInputChange(row.key, e.target.value)}
                          ref={(el) => {
                            const m = qtyInputRefs.current
                            if (!m) return
                            if (el) m.set(row.key, el)
                            else m.delete(row.key)
                          }}
                          onFocus={(e) => {
                            activeQtyRowKeyRef.current = row.key
                            activeQtySelectionRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onKeyUp={(e) => {
                            activeQtySelectionRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur()
                            }
                          }}
                          onBlur={async (e) => {
                            activeQtyRowKeyRef.current = null
                            commitQtyDraft(row.key, getOrderId(order), rowItemId, row.qty, e.target.value)
                          }}
                          disabled={disableBase || isQtyLocked || isMultiGroup || isWeightBased}
                        />
                      )}
                    </>
                  )}
                  {isSent && (
                    <>
                      <button
                        className="btn sale-cart-line__action-btn sale-cart-line__action-btn--note"
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
                        {cartActionLabel('note')}
                      </button>
                      <button
                        className="btn sale-cart-line__action-btn sale-cart-line__action-btn--ready"
                        onClick={() => {
                          if (isMultiGroup) {
                            toast.info('Hazır için Ayrı moduna geç')
                            return
                          }
                          completeItem(row.itemId)
                        }}
                        disabled={disableBase || isCompleteLocked}
                        title={isMultiGroup ? 'Hazır için Ayrı moduna geç' : undefined}
                        style={{ backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#6ee7b7', ...(isMultiGroup ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                      >
                        {cartActionLabel('ready')}
                      </button>
                      <button
                        className="btn sale-cart-line__action-btn sale-cart-line__action-btn--cancel"
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
                        {cartActionLabel('cancel')}
                      </button>
                    </>
                  )}
                  {isCompleted && (
                    <button
                      className="btn sale-cart-line__action-btn sale-cart-line__action-btn--cancel"
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
                      {cartActionLabel('cancel')}
                    </button>
                  )}
                </div>
                <div className="sale-cart-line__price" style={{ whiteSpace: 'nowrap' }}>{row.subtotal} TL</div>
              </div>
            )
          }

          const sentRender = buildCartRows(sentItems, cartViewMode, 'gs')

            return (
              <>
                {openRender.map(r => renderLine(r, { type: 'open', grouped: cartViewMode === 'grouped' }))}

                {sentItems.length > 0 && (
                  <div className="saleCartSectionLabel" style={{ fontSize: 12, color: 'var(--muted)' }}>Mutfağa Gönderilenler</div>
                )}
                {sentRender.map(r => renderLine(r, { type: 'sent', grouped: cartViewMode === 'grouped' }))}

                {otherItems.length > 0 && (
                  <div className="saleCartSectionLabel" style={{ fontSize: 12, color: 'var(--muted)' }}>Tamamlanan / İptal</div>
                )}
                {otherRender.map(r => renderLine(r, { type: 'other', grouped: cartViewMode === 'grouped' }))}
              </>
            )
          })()}
        </div>
      </div>

      {order && (
        <div className="saleCartFooter">
          <div className="saleCartFooterInner">
            <div className="saleCartFooterSummary">
              <div className="saleCartFooterSummaryMain">
                <div>Kalan</div>
                <div>{balanceDue.toFixed(2)} TL</div>
              </div>
              <div className="saleCartFooterSummaryMeta">
                {isMobilePortrait ? (
                  <div className="saleCartFooterSummaryMetaLine">
                    Brüt: {grossTotal.toFixed(2)} TL • İndirim: %{discountPercent || 0} • Net: {netTotal.toFixed(2)} TL
                    {paidTotal > 0 ? ` • Ödenen: ${paidTotal.toFixed(2)} TL` : ''}
                  </div>
                ) : (
                  <>
                    <div>Brüt: {grossTotal.toFixed(2)} TL</div>
                    <div>İndirim: %{discountPercent || 0} ({discountTotal.toFixed(2)} TL)</div>
                    <div>Net: {netTotal.toFixed(2)} TL</div>
                    {paidTotal > 0 && (
                      <div style={{ color: '#22c55e' }}>Ödenen: {paidTotal.toFixed(2)} TL</div>
                    )}
                  </>
                )}
              </div>
            </div>

            {isMobilePortrait ? (
              <div className="saleCartFooterActions saleCartFooterActions--mobile">
                <button
                  className="btn saleCartFooterActionBtn"
                  onClick={openPaymentModal}
                  disabled={!getOrderId(order)}
                >Ödeme Al</button>
                <button className="btn saleCartFooterActionBtn" onClick={() => setOrderCancelConfirmOpen(true)} disabled={(order?.paidTotal > 0) || order.status === 'cancelled'}>İptal</button>
                <button className="btn saleCartFooterActionBtn" type="button" onClick={openOrderNoteModal} disabled={!getOrderId(order)}>
                  Sipariş Notu
                </button>
                <button className="btn saleCartFooterActionBtn" onClick={openTransfer} disabled={!order.tableId || (order.status !== 'open' && order.status !== 'sent')}>Masa Taşı</button>
                <button className="btn saleCartFooterActionBtn" onClick={printReceiptOneClick} disabled={!getOrderId(order) || printingReceipt}>Fiş Yazdır</button>
                <button className="btn saleCartFooterActionBtn" type="button" onClick={openReceiptPreview} disabled={!getOrderId(order)}>Fişi Gör</button>
              </div>
            ) : (
              <div className="saleCartFooterActions">
                <button className="btn saleCartFooterActionBtn" type="button" onClick={openOrderNoteModal} disabled={!getOrderId(order)}>
                  Sipariş Notu
                </button>
                <button
                  className="btn saleCartFooterActionBtn"
                  onClick={openPaymentModal}
                  disabled={!getOrderId(order)}
                >Ödeme Al</button>
                <button className="btn saleCartFooterActionBtn" onClick={() => setOrderCancelConfirmOpen(true)} disabled={(order?.paidTotal > 0) || order.status === 'cancelled'}>İptal</button>
                <button className="btn saleCartFooterActionBtn" onClick={openTransfer} disabled={!order.tableId || (order.status !== 'open' && order.status !== 'sent')}>Masa Taşı</button>
                <button className="btn saleCartFooterActionBtn" onClick={printReceiptOneClick} disabled={!getOrderId(order) || printingReceipt}>Fiş Yazdır</button>
                <button className="btn saleCartFooterActionBtn" type="button" onClick={openReceiptPreview} disabled={!getOrderId(order)}>Fişi Gör</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="pageShell pos-layout" style={{ display: 'grid', gap: 12 }}>
      <div className="saleStandard3Col vhFit pos-grid">
        <div className="card saleProductsMobileIntro">
          <div className="saleProductsMobileIntroRow">
            {(tableName || tableId || location.state?.fromTables) && (
              <div className="saleProductsMobileIntroBack">
                <button className="btn saleProductsMobileBackBtn" type="button" onClick={backToTables} aria-label="Masalara dön">
                  ←
                </button>
              </div>
            )}
            <div className="saleProductsMobileIntroMeta">
              {tableName ? `Masa: ${tableName}` : 'Masasız Satış'}
              {order?.orderNo ? ` • Sipariş ${order.orderNo}` : ' • Sipariş —'}
              {order?.createdByName ? ` • Alan: ${order.createdByName}` : ''}
              {mergedBadge ? ' • Birleşik' : ''}
            </div>
          </div>
        </div>

        <SaleCategorySidebar categories={categories} activeCategoryId={activeCategory} onSelect={handleCategorySelect} />

        <div className="card salePanel saleProductsPanel">
          <div className="saleProductsPanelHeader">
            {(tableName || tableId || location.state?.fromTables) && (
              <div style={{ marginBottom: 10 }}>
                <button className="btn" type="button" onClick={backToTables}>
                  Masalara Dön
                </button>
              </div>
            )}
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
              {tableName ? `Masa: ${tableName}` : 'Masasız Satış'}
              {order?.orderNo ? ` • Sipariş ${order.orderNo}` : ' • Sipariş —'}
              {order?.createdByName ? ` • Alan: ${order.createdByName}` : ''}
              {mergedBadge ? ' • Birleşik' : ''}
            </div>
            <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Ürünler</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredItems.length} ürün</div>
            </div>
          </div>
          <div
            ref={productScrollRef}
            className="salePanelScroll saleProductsVirtualScroll"
            style={{ paddingTop: 10 }}
          >
            {productsVirtualized ? <div style={{ height: topProductSpacer }} aria-hidden="true" /> : null}
            <div ref={productGridMeasureRef} className="posItemsGrid">
              <SalesProductGrid
                visibleItems={visibleMenuItems}
                onItemClick={addItem}
                isMobilePortrait={isMobilePortrait}
                productCardMeasureRef={productCardMeasureRef}
                showProductImages={showProductImages}
              />
            </div>
            {productsVirtualized ? <div style={{ height: bottomProductSpacer }} aria-hidden="true" /> : null}
          </div>
        </div>

        <div className="card salePanel saleCartPanelShell">
          <CartPanel />
        </div>
      </div>

    <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Ödeme Al" dialogStyle={{ width: 'min(700px, calc(100vw - 32px))' }} bodyStyle={{ paddingTop: 10, paddingInline: 16, paddingBottom: 14 }}>
      <div className="payment-modal-stack">
        <div className="payment-meta-line">
          {tableName ? `Masa: ${tableName}` : 'Masasız'} • {order?.orderNo ? `Sipariş ${order.orderNo}` : 'Sipariş —'}
        </div>

        <div className="payment-panel">
          <div className="payment-panel-body payment-summary-card">
            <div className="payment-summary-row">
              <div style={{ color: 'var(--muted)' }}>Brüt</div>
              <div style={{ fontWeight: 600 }}>{grossTotal.toFixed(2)} TL</div>
            </div>
            <div className="payment-summary-row payment-summary-row--editor">
              <div style={{ color: 'var(--muted)' }}>İndirim (%)</div>
              <div className="payment-summary-actions">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input"
                  value={discountDraft}
                  onChange={(e) => setDiscountDraft(e.target.value)}
                  disabled={!canTakePayment || busy}
                />
                <button className="btn btn--compact" onClick={applyDiscount} disabled={!canTakePayment || busy}>
                  Uygula
                </button>
              </div>
            </div>
            <div className="payment-summary-row">
              <div style={{ color: 'var(--muted)' }}>İndirim Tutarı</div>
              <div style={{ fontWeight: 600 }}>{discountTotal.toFixed(2)} TL</div>
            </div>
            <div className="payment-summary-row">
              <div style={{ color: 'var(--muted)' }}>Net</div>
              <div style={{ fontWeight: 700 }}>{netTotal.toFixed(2)} TL</div>
            </div>
            <div className="payment-summary-row">
              <div style={{ color: 'var(--muted)' }}>Ödenen</div>
              <div style={{ fontWeight: 600 }}>{paidTotal.toFixed(2)} TL</div>
            </div>
            <div className="payment-summary-row">
              <div style={{ color: 'var(--muted)' }}>{signedBalanceLabel}</div>
              <div style={{ fontWeight: 700 }}>{signedBalanceValue.toFixed(2)} TL</div>
            </div>
          </div>
        </div>

        {previousLines.length > 0 && (
          <div className="payment-panel">
            <div className="payment-panel-body">
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Önceki Ödemeler</div>
            <div className="payment-history-list">
              {previousLines.map((r) => (
                <div key={`${r.kind}:${r.id}`} className="payment-history-row">
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
                      className="btn btn--compact"
                      onClick={() => {
                        if (r.kind === 'payment') return deletePayment(r.id)
                        if (r.kind === 'veresiye') return deleteVeresiyeEntry(r.id)
                        if (r.kind === 'collection') return deleteCollection(r.id)
                        if (r.kind === 'discount') return deleteDiscount()
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
          </div>
        )}

        <div className="payment-panel">
          <div className="payment-panel-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div className="payment-field-label">Ödeme Böl</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {splitSelectedRows.length > 0
                    ? `${splitSelectedRows.length} ürün seçildi • ${splitSelectedAmount.toFixed(2)} TL`
                    : 'Aynı fiş içinde ürün bazlı ödeme seçebilirsiniz.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {canEditEntryDate ? (
                  <SalesEntryDateButton
                    value={paymentEntryDate}
                    onChange={(value) => setPaymentEntryDate(writeSalesEntryDate(value))}
                    title="Ödeme tarihini seç"
                    showValue
                  />
                ) : null}
                <button className="btn btn--compact" type="button" onClick={openSplit} disabled={!canSplitOrder || busy}>
                  Ödeme Böl
                </button>
                {splitSelectedRows.length > 0 && (
                  <button
                    className="btn btn--compact"
                    type="button"
                    onClick={() => {
                      setSplitSelection({})
                      setPaymentAmount(balanceDue > 0 ? String(balanceDue) : '')
                    }}
                    disabled={busy}
                  >
                    Seçimi Temizle
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="payment-field-label">Yöntem</div>
              <div className="payment-method-grid">
                {payMethods.map((m) => {
                  const active = paymentMethod === m.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      className={`btn payment-method-btn ${active ? 'is-active' : ''}`}
                      disabled={!canTakePayment || busy}
                      onClick={() => setPaymentMethod(m.key)}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <label>
              <div className="payment-field-label">Tutar</div>
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
              <div className="payment-field-label">Not (opsiyonel)</div>
              <input className="input" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} disabled={!canTakePayment || busy} />
            </label>
            {selectedPaymentIsCash && (
              <div className="payment-summary-row" style={{ fontSize: 12, color: 'var(--muted)' }}>
                <div>Paraüstü</div>
                <div style={{ fontWeight: 600 }}>{changeDue.toFixed(2)} TL</div>
              </div>
            )}
            <div className="payment-actions">
              <button className="btn btn--compact" onClick={payOrder} disabled={!canTakePayment || busy || balanceDue <= 0.01}>
                Ödeme Ekle
              </button>
              <button className="btn btn--compact" onClick={openVeresiye} disabled={!canCreateVeresiye || creditAccountsDisabled || busy || balanceDue <= 0.01}>
                Veresiye Yap
              </button>
              <button className="btn btn--compact" onClick={() => setPayOpen(false)} disabled={busy}>
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
        <div className="app-modal-footer">
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
        <div className="app-modal-footer">
          <button className="btn" onClick={submitCreateAccount} disabled={busy}>
            Kaydet
          </button>
          <button className="btn" onClick={() => setIsCreateAccountOpen(false)} disabled={busy}>
            Vazgeç
          </button>
        </div>
      </div>
    </Modal>


    <Modal open={splitOpen} onClose={() => setSplitOpen(false)} title="Ödeme Böl">
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aynı sipariş içinden ödemesi alınacak ürünleri seçin. Ürünler sepette kalır, sadece ödeme tutarı bölünür.</div>
        <div style={{ display: 'grid', gap: 8, maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
          {payableSplitRows.map((row) => {
            const item = row?.repr || {}
            const itemId = String(row?.itemId || item?._id || item?.id || '')
            const servingLabel = servingTypeLabelTR(item?.servingType || order?.servingType, { fallback: '' })
            const unitPrice = Number(item?.priceSnapshot ?? row?.subtotal ?? 0)
            const note = String(row?.note || item?.note || '').trim()
            const selected = splitSelection?.[row.key] === true
            return (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px' }}>
                <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                  <div style={{ fontWeight: 700 }}>{item?.nameSnapshot || 'Ürün'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {unitPrice.toFixed(2)} TL
                    {servingLabel ? ` • ${servingLabel}` : ''}
                    {itemId ? ` • #${itemId.slice(-4)}` : ''}
                  </div>
                  {note ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not: {note}</div> : null}
                </div>
                <button
                  type="button"
                  className="btn btn--toggle"
                  aria-pressed={selected}
                  onClick={() => setSplitSelection((prev) => ({ ...(prev || {}), [row.key]: !selected }))}
                >
                  {selected ? 'Seçildi' : 'Seç'}
                </button>
              </div>
            )
          })}
          {payableSplitRows.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Ödeme böl için seçilebilir ürün kalmadı.</div>
          ) : null}
        </div>
        {splitSelectedRows.length > 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Seçilen ürünlerin net ödeme tutarı: <strong style={{ color: 'var(--text)' }}>{splitSelectedAmount.toFixed(2)} TL</strong>
          </div>
        ) : null}
        <div className="app-modal-footer">
          <button className="btn" onClick={submitSplit} disabled={payableSplitRows.length === 0}>Tutari Uygula</button>
        </div>
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
        <div className="app-modal-footer">
          <button className="btn" onClick={submitTransfer} disabled={!targetTableId}>Taşı</button>
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
      open={weightModalOpen}
      onClose={() => {
        setWeightModalOpen(false)
        setPendingWeightItem(null)
        setWeightModalValue('')
      }}
      title="Kaç Gram?"
      initialValue={weightModalValue}
      placeholder="Örn: 350"
      onSubmit={submitWeightItem}
    />
    <ProductConfigModal
      open={productConfigOpen}
      item={pendingConfigItem}
      onClose={() => {
        setProductConfigOpen(false)
        setPendingConfigItem(null)
      }}
      onSubmit={submitConfiguredItem}
    />
    <InputModal
      open={cancelModalOpen}
      onClose={() => setCancelModalOpen(false)}
      title="İptal Sebebi"
      initialValue=""
      placeholder="İptal sebebi..."
      onSubmit={submitItemCancel}
      autoFocus={false}
    />
    <Modal open={orderNoteModalOpen} onClose={() => setOrderNoteModalOpen(false)} title="Sipariş Notu" dialogStyle={{ width: 'min(560px, calc(100vw - 32px))' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <textarea
          className="input saleOrderNoteModalTextarea"
          rows="4"
          value={orderNoteDraft}
          onChange={(e) => setOrderNoteDraft(e.target.value)}
          placeholder="Sipariş notu..."
        />
        <div className="app-modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={() => setOrderNoteModalOpen(false)}>
            Vazgeç
          </button>
          <button className="btn" type="button" onClick={submitOrderNote} disabled={!getOrderId(order)}>
            Kaydet
          </button>
        </div>
      </div>
    </Modal>
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
