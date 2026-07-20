import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import SaleCategorySidebar from '../components/SaleCategorySidebar.jsx'
import SalesProductGrid from '../components/SalesProductGrid.jsx'
import ProductImage from '../components/ProductImage.jsx'
import SaleCartLine from '../components/SaleCartLine.jsx'
import { ServingType, normalizeServingType, servingTypeLabelTR } from '../utils/servingType.js'
import { enqueueReceiptPrint } from '../lib/printingClient.js'
import { buildCartRows } from '../lib/cartItemRows.js'
import { getKitchenItemStatusMeta, isKitchenActiveItemStatus, isKitchenTerminalItemStatus } from '../lib/kitchenItemStatus.js'
import { isCashPaymentMethod, paymentMethodLabel, pickInitialPaymentMethod } from '../lib/paymentMethods.js'
import { requiresProductConfig } from '../lib/productPortions.js'
import { openReceiptPopup } from '../lib/receiptPopup.js'
import { readSalesEntryDate, todayYmd, writeSalesEntryDate } from '../lib/salesEntryDate.js'
import useVirtualProductGrid from '../hooks/useVirtualProductGrid.js'
import { diffPerfCounter, getPerfNow, incrementPerfCounter, isPerfDebugEnabled, logPerf, markPerfEnd, markPerfStart, snapshotPerfCounter } from '../lib/perfDebug.js'

export default function WalkInPosPage() {
  const perfDebugEnabled = isPerfDebugEnabled()
  const nav = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { isMobilePortrait } = useResponsiveFlags()
  const routeOrderId = params?.orderId || null
  const isOrderView = !!routeOrderId && isValidObjectId(routeOrderId)
  const { user, allowedBranchIds } = useAuth()
  const canEditEntryDate = user?.role === 'tenant_admin'
  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canTakePayment = hasPerm('take_payment')
  const canCreateVeresiye = hasPerm('create_veresiye')
  const { getSetting } = useBusinessSettings()
  const creditAccountsDisabled = getSetting('general.disableCreditAccounts', false) === true
  const requireCancelReasonForProduct = getSetting('general.requireCancelReasonForProduct', false) === true
  const showProductImages = true
  const canViewAccounts = hasPerm('view_accounts')
  const canManageAccounts = hasPerm('manage_accounts')
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [activeOrders, setActiveOrders] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [branchPickerOpen, setBranchPickerOpen] = useState(false)
  const [branchPickerLoading, setBranchPickerLoading] = useState(false)
  const [branchPickerError, setBranchPickerError] = useState('')
  const [availableBranches, setAvailableBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    try { return String(localStorage.getItem('selectedBranchId') || '').trim() } catch { return '' }
  })

  const [order, setOrder] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [entryDate, setEntryDate] = useState(() => (canEditEntryDate ? readSalesEntryDate() : todayYmd()))
  const [paymentEntryDate, setPaymentEntryDate] = useState(() => todayYmd())
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
  const [customerNameDraft, setCustomerNameDraft] = useState('')
  
  const [busy, setBusy] = useState(false)
  const [qtyDraftByRow, setQtyDraftByRow] = useState(() => ({}))
  const qtyDraftByRowRef = useRef({})
  const [cartViewMode, setCartViewMode] = useState('grouped')
  const [servingType, setServingType] = useState(ServingType.PLATE)
  const cartActionLabel = (kind) => {
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
        <div>{detailText}</div>
        {servingLabel ? (
          <div className="sale-cart-line__serving-note">
            <span className="sale-cart-line__serving-pill">Servis: {servingLabel}</span>
          </div>
        ) : null}
      </div>
    )
  }

  const [payMethods, setPayMethods] = useState([])
  const inflightRef = useRef(new Map())
  const lastClickRef = useRef(new Map())
  const currentOrderIdRef = useRef(null)
  const optimisticItemSeqRef = useRef(0)
  const [, setLockTick] = useState(0)
  const itemsApiCallCountRef = useRef(0)
  const categoryPerfRef = useRef(null)
  const cartRenderSnapshotRef = useRef({})
  const lastCartSignatureRef = useRef('')

  const qtyInputRefs = useRef(new Map())
  const activeQtyRowKeyRef = useRef(null)
  const activeQtySelectionRef = useRef({ start: null, end: null })

  const qtyPendingRef = useRef(new Map())
  const qtyTimerRef = useRef(new Map())
  const qtyInflightRef = useRef(new Set())
  const qtyCooldownUntilRef = useRef(new Map())
  const qtyLastToastAtRef = useRef(new Map())

  incrementPerfCounter('pageRenders', 'WalkInPosPage')

  const normalizedAllowedBranchIds = useMemo(
    () => Array.from(new Set((Array.isArray(allowedBranchIds) ? allowedBranchIds : []).map((id) => String(id || '').trim()).filter(Boolean))),
    [allowedBranchIds]
  )

  useEffect(() => {
    const syncSelectedBranch = () => {
      try {
        setSelectedBranchId(String(localStorage.getItem('selectedBranchId') || '').trim())
      } catch {
        setSelectedBranchId('')
      }
    }
    syncSelectedBranch()
    window.addEventListener('selected_branch_changed', syncSelectedBranch)
    return () => window.removeEventListener('selected_branch_changed', syncSelectedBranch)
  }, [])

  useEffect(() => {
    if (!canEditEntryDate) setEntryDate(todayYmd())
  }, [canEditEntryDate])

  useEffect(() => {
    if (!canEditEntryDate) setPaymentEntryDate(todayYmd())
  }, [canEditEntryDate])

  const loadAvailableBranches = useCallback(async () => {
    setBranchPickerLoading(true)
    setBranchPickerError('')
    try {
      const res = await api('/api/branches', { skipBranchHeader: true, silent: true, suppressBranchModal: true })
      const list = Array.isArray(res?.branches) ? res.branches : []
      const filtered = list.filter((branch) => {
        const id = String(branch?._id || branch?.id || '').trim()
        if (!id) return false
        if (branch?.isActive === false) return false
        return normalizedAllowedBranchIds.length === 0 || normalizedAllowedBranchIds.includes(id)
      })
      setAvailableBranches(filtered)
      return filtered
    } catch (err) {
      setBranchPickerError(err?.message || 'Şubeler yüklenemedi')
      setAvailableBranches([])
      return []
    } finally {
      setBranchPickerLoading(false)
    }
  }, [normalizedAllowedBranchIds])

  useEffect(() => {
    qtyDraftByRowRef.current = qtyDraftByRow || {}
  }, [qtyDraftByRow])

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

  const flushQtyUpdate = async (orderId, itemId) => {
    const oId = String(orderId || '')
    const id = String(itemId || '')
    if (!oId || !id) return
    if (qtyInflightRef.current.has(id)) return
    const pending = qtyPendingRef.current.get(id)
    if (!pending) return
    const cooldownUntil = qtyCooldownUntilRef.current.get(id) || 0
    if (Date.now() < cooldownUntil) return

    qtyInflightRef.current.add(id)
    setLockTick(t => t + 1)
    try {
      const res = await api(`/api/pos/orders/${oId}/items/${id}/quantity`, {
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
          setTimeout(() => flushQtyUpdate(oId, id), 2100)
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
    if (tPrev) clearTimeout(tPrev)
    if (flushNow) {
      flushQtyUpdate(oId, iId)
      return
    }
    const t = setTimeout(() => flushQtyUpdate(oId, iId), 420)
    qtyTimerRef.current.set(iId, t)
  }

  const flushPendingOrderEdits = async () => {
    try {
      for (const timer of qtyTimerRef.current.values()) clearTimeout(timer)
      qtyTimerRef.current.clear()
    } catch {}

    const pendingEntries = Array.from(qtyPendingRef.current.entries())
    for (const [itemId, pending] of pendingEntries) {
      await flushQtyUpdate(String(pending?.orderId || ''), itemId)
    }

    await saveNote()
  }

  useEffect(() => {
    return () => {
      try {
        for (const t of qtyTimerRef.current.values()) clearTimeout(t)
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
  const loadItems = async () => {
    itemsApiCallCountRef.current += 1
    logPerf('WalkInPosPage', 'menu-items-request', {
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

  useEffect(() => {
    if (!isOrderView) return
    loadCategories()
  }, [isOrderView])
  useEffect(() => {
    if (!isOrderView) return
    loadItems()
  }, [isOrderView])

  const filteredItems = useMemo(() => {
    const activeId = String(activeCategory || '').trim()
    const nextItems = !activeId
      ? items
      : (items || []).filter((item) => String(item?.categoryId || '') === activeId)
    logPerf('WalkInPosPage', 'filter-result', {
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
    markPerfStart('WalkInPosPage', 'category-change', {
      categoryId: String(categoryId || ''),
      previousCategoryId: String(activeCategory || '')
    })
    startTransition(() => {
      setActiveCategory(String(categoryId || ''))
    })
  }, [activeCategory])

  useEffect(() => {
    if (!isOrderView) return
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
  }, [isOrderView, Array.isArray(allowedBranchIds) ? allowedBranchIds.join(',') : ''])

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
    const createWalkInOrderForBranch = async (branchIdOverride) => {
      try {
        const res = await api('/api/pos/walkin/orders', {
          method: 'POST',
          data: { customerName: 'Misafir', note: '', entryDate },
          branchIdOverride,
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

    const currentSelectedBranchId = (() => {
      const raw = String(selectedBranchId || '').trim()
      if (raw) return raw
      try { return String(localStorage.getItem('selectedBranchId') || '').trim() } catch { return '' }
    })()
    const hasSelectedAllowedBranch = currentSelectedBranchId && (
      normalizedAllowedBranchIds.length === 0 || normalizedAllowedBranchIds.includes(currentSelectedBranchId)
    )

    if (user?.role === 'tenant_admin' && normalizedAllowedBranchIds.length > 1) {
      await loadAvailableBranches()
      setBranchPickerOpen(true)
      return
    }

    if (!hasSelectedAllowedBranch) {
      if (normalizedAllowedBranchIds.length === 1) {
        const onlyBranchId = normalizedAllowedBranchIds[0]
        try {
          localStorage.setItem('selectedBranchId', onlyBranchId)
          setSelectedBranchId(onlyBranchId)
        } catch {}
        await createWalkInOrderForBranch(onlyBranchId)
        return
      }
      await loadAvailableBranches()
      setBranchPickerOpen(true)
      return
    }

    try {
      await createWalkInOrderForBranch(currentSelectedBranchId)
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Sunucu hatası. Tekrar deneyin.')
    }
  }

  const currentOrderId = selectedOrderId || getOrderId(order)

  useEffect(() => {
    currentOrderIdRef.current = selectedOrderId || getOrderId(order)
  }, [order, selectedOrderId])

  const addOptimisticOrderItem = useCallback((menuItem) => {
    const product = (menuItem && typeof menuItem === 'object') ? menuItem : null
    const menuItemId = String(product?.id || product?.menuItemId || '')
    if (!menuItemId) return null
    const tempId = `tmp:${menuItemId}:${Date.now()}:${optimisticItemSeqRef.current++}`
    const unitPrice = Number(product?.price || 0)
    const nextServingType = normalizeServingType(product?.servingType || servingType || order?.servingType, { fallback: null })
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
  }, [order?.servingType, servingType])

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
    const key = `${orderId}:${menuItemId}:add`
    if (isDebounced(key, 200)) return
    const result = await withLock(key, () => api(`/api/pos/orders/${orderId}/items`, {
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
    const orderId = selectedOrderId || getOrderId(order)
    const menuItemId = String(payload?.menuItemId || '').trim()
    if (!orderId || !menuItemId) return false
    const key = `${orderId}:${menuItemId}:add:${String(payload?.portionKey || 'full')}:${String(payload?.weightGrams || '')}`
    if (isDebounced(key, 200)) return false
    const result = await withLock(key, () => api(`/api/pos/orders/${orderId}/items`, {
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
    debugKey: 'WalkInPosPage',
    resetDeps: [activeCategory, selectedOrderId]
  })

  useEffect(() => {
    if (!perfDebugEnabled) return
    if (!categoryPerfRef.current) return
    const renderedDomCount = productScrollRef.current
      ? productScrollRef.current.querySelectorAll('.productCard').length
      : 0
    const elapsedMs = markPerfEnd('WalkInPosPage', 'category-change', {
      categoryId: String(activeCategory || ''),
      filteredCount: filteredItems.length,
      visibleCount: visibleMenuItems.length,
      renderedDomCount,
      apiRequestsDuringChange: itemsApiCallCountRef.current - Number(categoryPerfRef.current.apiRequestCountBefore || 0)
    })
    logPerf('WalkInPosPage', 'category-change-summary', {
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
      logPerf('WalkInPosPage', 'virtual-grid-dom', {
        ...productGridDebug,
        renderedDomCount
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [isMobilePortrait, perfDebugEnabled, productGridDebug, productScrollRef])

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
    logPerf('WalkInPosPage', 'cart-change-rerenders', {
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
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId || !menuItemId) return false

    const grams = Math.round(Number(String(value || '').replace(',', '.')))
    if (!Number.isFinite(grams) || grams <= 0) {
      toast.error('Gram bilgisi geçersiz')
      return false
    }

    const isEdit = !!menuItem?.existingItemId
    const key = isEdit ? `${orderId}:${menuItem.existingItemId}:weight:${grams}` : `${orderId}:${menuItemId}:add:${grams}`
    if (isDebounced(key, 200)) return false
    const result = await withLock(key, () => api(isEdit ? `/api/pos/orders/${orderId}/items/${menuItem.existingItemId}/weight` : `/api/pos/orders/${orderId}/items`, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(isEdit ? { weightGrams: grams } : { menuItemId, weightGrams: grams }),
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
    const reason = String(val || '').trim()
    if (requireCancelReasonForProduct && !reason) {
      toast.error('İptal nedeni zorunlu')
      return false
    }
    const key = `${orderId}:${selectedItemForCancel}:cancel`
    if (isDebounced(key, 250)) return
    const res = await withLock(key, () => safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/items/${selectedItemForCancel}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }), signal, silent: true }),
      { reload: false }
    ))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
    setCancelModalOpen(false)
  }
  const saveNote = async (nextNote = note) => {
    const orderId = selectedOrderId || getOrderId(order)
    if (!orderId) {
      toast.error('Sipariş bulunamadı')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${orderId}/note`, { method: 'PUT', data: { note: nextNote }, signal, silent: true }),
      { reload: false }
    )
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
    if (ok) setOrderNoteModalOpen(false)
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

    await flushPendingOrderEdits()

    const payload = {
      servingType: normalizeServingType(servingType),
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
    if (!String(paymentMethod || '').trim()) {
      toast.error('Odeme yontemi secin')
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
      (signal) => api(`/api/pos/orders/${currentOrderId}/payments`, { method: 'POST', data: { method: paymentMethod, amount, note: paymentNote, entryDate: paymentEntryDate }, signal, silent: true }),
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

  const deleteDiscount = async () => {
    setDiscountDraft(0)
    const currentOrderId = order?._id || order?.id || selectedOrderId
    if (!currentOrderId) {
      toast.error('Sipariş bulunamadı (orderId yok)')
      setError('Sipariş bulunamadı')
      return
    }
    const res = await safeAction(
      (signal) => api(`/api/pos/orders/${currentOrderId}/discount`, { method: 'PUT', data: { discountPercent: 0 }, signal, silent: true }),
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
    if (!canCreateVeresiye || creditAccountsDisabled) {
      toast.error(creditAccountsDisabled ? 'Cari hesap özelliği kapalı' : 'Veresiye yetkiniz yok')
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
    if (creditAccountsDisabled) {
      toast.error('Cari hesap özelliği kapalı')
      return
    }
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

    const rawAmount = String(veresiyeAmount || '').trim()
    const parsedAmount = rawAmount ? Number(rawAmount) : NaN
    const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined

    const payload = { accountId: selectedAccount.id, note: veresiyeNote }
    if (amount !== undefined) payload.amount = amount

    const res = await safeAction((signal) => api(`/api/pos/orders/${currentOrderId}/veresiye`, {
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
    const currentOrderId = order?._id || order?.id || selectedOrderId
    if (!currentOrderId || !entryId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${currentOrderId}/veresiye/${entryId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
    }
  }

  const deleteCollection = async (txId) => {
    const currentOrderId = order?._id || order?.id || selectedOrderId
    if (!currentOrderId || !txId) return
    const res = await safeAction((signal) => api(`/api/pos/orders/${currentOrderId}/collections/${txId}`, { method: 'DELETE', signal, silent: true }))
    const fresh = pickOrder(res)
    if (fresh) {
      setNote(fresh.note || '')
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
            {selectedBranchId ? (
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>Aktif şube: {selectedBranchId}</div>
            ) : null}
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
    <div className="pageShell walkin-sales-page walkin-layout" style={{ gap: 12 }}>
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
        {canEditEntryDate ? (
          <SalesEntryDateButton
            value={entryDate}
            onChange={(value) => setEntryDate(writeSalesEntryDate(value))}
            title="Sipariş tarihini seç"
          />
        ) : null}
        <button
          className="btn btn--danger"
          onClick={closeSelectedOrder}
          disabled={!getOrderId(order) || busy}
        >
          Kapat
        </button>
      </div>

      <div className="walkin-sales-page__body" style={{ flex: 1, minHeight: 0, overflow: isMobilePortrait ? 'visible' : 'hidden' }}>
        <div className="saleStandard3Col pos-grid" style={{ minHeight: 0 }}>
          <div className="card saleProductsMobileIntro saleProductsMobileIntro--empty" aria-hidden="true" />

          <SaleCategorySidebar categories={categories} activeCategoryId={activeCategory} onSelect={handleCategorySelect} />

          <div className="card salePanel saleProductsPanel">
            <div className="saleProductsPanelHeader" style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Ürünler</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredItems.length} ürün</div>
            </div>
            {!order ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)' }}>Yükleniyor...</div>
            ) : (
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
            )}
          </div>

          <div ref={cartAnchorRef} className="card salePanel saleCartPanelShell walkin-cart-panel" style={{ minHeight: 0 }}>
            <div className="saleCartPanelContent">
              <div className="saleCartHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Sepet</h3>
                <div />
              </div>

              {error && <div style={{ color: '#ef4444', marginTop: 8 }}>{error}</div>}

              <div className="saleCartModeRow" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
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

              <div className="saleCartSubRow" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
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
                    {effectiveKitchenEnabled === false
                      ? 'Onayla (Mutfak Kapalı)'
                      : `Mutfağa Gönder (${servingTypeLabelTR(servingType) || '-'})`}
                  </button>
                </div>
              )}

              <div className="saleCartList order-cart-scroll scrollbar-hidden" style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {(() => {
                  const raw = Array.isArray(order?.items) ? order.items : []
                  const openItems = raw.filter(it => it?.status === 'open')
                  const canShowPrep = effectiveKitchenEnabled !== false
                  const prepItems = raw.filter(it => isKitchenActiveItemStatus(it?.status))
                  const sentItems = canShowPrep ? prepItems : []
                  const approvedItems = canShowPrep ? [] : prepItems
                  const otherItems = raw.filter(it => isKitchenTerminalItemStatus(it?.status))

                  const otherRender = buildCartRows(otherItems, cartViewMode, 'o')
                  const openRender = buildCartRows(openItems, cartViewMode, 'g')
                  const sentRender = buildCartRows(sentItems, cartViewMode, 's')
                  const approvedRender = buildCartRows(approvedItems, cartViewMode, 'a')

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
                    scheduleQtyUpdate(orderId, itemId, row.key, nextQty)
                  }

                  const renderLine = (row, opts = {}) => {
                  const it = row.repr
                  const isOpen = opts.type === 'open'
                  const isSent = opts.type === 'sent'
                  const isTerminal = opts.type === 'other'
                  const isGrouped = opts.grouped === true
                  const isMultiGroup = isGrouped && Array.isArray(row.itemIds) && row.itemIds.length > 1
                  const isWeightBased = !!it?.isWeightBased
                  const weightGrams = Number(it?.weightGrams) || 0
                  const disableBase = busy || !getOrderId(order)
                    const orderId = selectedOrderId || getOrderId(order)
                    const itemId = row?.repr?.id || row?.repr?._id || row?.repr?.itemId || row?.itemId || null
                    const qtyLockKey = orderId && itemId ? `${orderId}:${itemId}:qty` : null
                    const noteLockKey = orderId && itemId ? `${orderId}:${itemId}:note` : null
                    const cancelLockKey = orderId && itemId ? `${orderId}:${itemId}:cancel` : null
                    const isQtyLocked = !!(qtyLockKey && inflightRef.current.get(qtyLockKey)) || qtyInflightRef.current.has(String(itemId || '')) || (qtyCooldownUntilRef.current.get(String(itemId || '')) || 0) > Date.now()
                    const isNoteLocked = !!(noteLockKey && inflightRef.current.get(noteLockKey))
                  const isCancelLocked = !!(cancelLockKey && inflightRef.current.get(cancelLockKey))
                  const rawDraft = getQtyDraft(row.key, row.qty)
                  const parsedDraft = rawDraft === '' ? NaN : Number(rawDraft)
                  const displayQty = Number.isFinite(parsedDraft) ? Math.max(0, Math.floor(parsedDraft)) : row.qty
                  const unitPrice = Number(it?.priceSnapshot ?? (displayQty > 0 ? row.subtotal / displayQty : row.subtotal) ?? 0)
                  const detailText = isWeightBased
                    ? `${unitPrice} TL/KG • ${weightGrams} gr`
                    : `${unitPrice} TL • x${displayQty}`
                  const badge = getKitchenItemStatusMeta(it?.status, { compact: true })

                  return (
                    <SaleCartLine
                      key={row.key}
                      className={`walkin-cart-line${isTerminal ? ' sale-cart-line--terminal' : ''}`}
                      style={{
                        opacity: (it?.status === 'completed' || it?.status === 'cancelled') ? 0.6 : 1
                      }}
                      onInfoClick={() => {
                        if (isOpen && isWeightBased && !isMultiGroup) openWeightEditor({ ...it, itemId })
                      }}
                      infoStyle={isOpen && isWeightBased && !isMultiGroup ? { cursor: 'pointer' } : undefined}
                      title={it?.nameSnapshot}
                      badge={badge ? (
                        <span className={`page-pill sale-cart-line-status${it?.status === 'open' ? ' sale-cart-line-status--open-dark' : ''}`} style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}>
                          {badge.label}
                        </span>
                      ) : null}
                      detail={renderServingTypeDetail(it, detailText, isOpen ? servingType : null)}
                      actions={(
                        <>
                          {isOpen && (
                            <>
                              <button
                                className="btn sale-cart-line__action-btn sale-cart-line__action-btn--note"
                                onClick={() => {
                                  if (isMultiGroup) {
                                    toast.info('Bu işlem için Ayrı moduna geç')
                                    return
                                  }
                                  if (isWeightBased) {
                                    removeItem(itemId)
                                    return
                                  }
                                  const currentQty = Number(displayQty) || 0
                                  const nextQty = currentQty <= 1 ? 0 : currentQty - 1
                                  setItemQtyByRow(row, nextQty)
                                }}
                                disabled={disableBase || isMultiGroup || isQtyLocked}
                                title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}
                              >
                                -
                              </button>
                              <button
                                className="btn sale-cart-line__action-btn sale-cart-line__action-btn--note"
                                onClick={() => {
                                  if (isMultiGroup) {
                                    toast.info('Bu işlem için Ayrı moduna geç')
                                    return
                                  }
                                  if (isWeightBased) {
                                    openWeightEditor({ ...it, itemId })
                                    return
                                  }
                                  const currentQty = Number(displayQty) || 0
                                  const nextQty = currentQty + 1
                                  setItemQtyByRow(row, nextQty)
                                }}
                                disabled={disableBase || isMultiGroup || isQtyLocked}
                                title={isMultiGroup ? 'Bu işlem için Ayrı moduna geç' : undefined}
                              >
                                +
                              </button>
                              <button
                                className="btn sale-cart-line__action-btn sale-cart-line__action-btn--cancel"
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
                                    commitQtyDraft(row.key, selectedOrderId || getOrderId(order), itemId, row.qty, e.target.value)
                                  }}
                                  disabled={disableBase || isMultiGroup || isQtyLocked || isWeightBased}
                                />
                              )}
                            </>
                          )}
                          {isSent && (
                            <>
                              <button
                                className="btn sale-cart-line__action-btn"
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
                                {cartActionLabel('note')}
                              </button>
                              <button
                                className="btn sale-cart-line__action-btn"
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
                                {cartActionLabel('cancel')}
                              </button>
                            </>
                          )}
                        </>
                      )}
                      price={`${row.subtotal} TL`}
                    />
                  )
                  }

                  return (
                    <>
                      {openRender.map(r => renderLine(r, { type: 'open', grouped: cartViewMode === 'grouped' }))}
                      {sentItems.length > 0 && (
                        <div className="saleCartSectionLabel" style={{ fontSize: 12, color: 'var(--muted)' }}>Hazırlanacaklar</div>
                      )}
                      {sentRender.map(r => renderLine(r, { type: 'sent', grouped: cartViewMode === 'grouped' }))}

                      {approvedItems.length > 0 && (
                        <div className="saleCartSectionLabel" style={{ fontSize: 12, color: 'var(--muted)' }}>Onaylanan Ürünler</div>
                      )}
                      {approvedRender.map(r => renderLine(r, { type: 'sent', grouped: cartViewMode === 'grouped' }))}
                      {otherItems.length > 0 && <div className="saleCartSectionLabel" style={{ fontSize: 12, color: 'var(--muted)' }}>Tamamlanan / İptal</div>}
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
                      <div style={{ color: signedBalance < -0.01 ? '#b91c1c' : undefined }}>{signedBalanceLabel}</div>
                      <div style={{ color: signedBalance < -0.01 ? '#b91c1c' : undefined }}>{signedBalanceValue.toFixed(2)} TL</div>
                    </div>
                    <div className="saleCartFooterSummaryMeta">
                      <div>Brüt: {grossTotal.toFixed(2)} TL</div>
                      <div>İndirim: %{discountPercent || 0} ({discountTotal.toFixed(2)} TL)</div>
                      <div>Net: {netTotal.toFixed(2)} TL</div>
                      {paidTotal > 0 && (
                        <div style={{ color: '#22c55e' }}>Ödenen: {paidTotal.toFixed(2)} TL</div>
                      )}
                    </div>
                  </div>
                  <div className="saleCartFooterActions">
                    <button
                      className="btn saleCartFooterActionBtn"
                      type="button"
                      onClick={openOrderNoteModal}
                      disabled={!getOrderId(order)}
                    >
                      Sipariş Notu
                    </button>
                    <button
                      className="btn saleCartFooterActionBtn"
                      onClick={openPaymentModal}
                      disabled={!getOrderId(order)}
                    >Ödeme Al</button>
                    <button className="btn saleCartFooterActionBtn" onClick={() => setOrderCancelConfirmOpen(true)} disabled={order.paymentStatus === 'paid' || order.status === 'cancelled'}>İptal</button>

                    <button className="btn saleCartFooterActionBtn" onClick={printReceiptOneClick} disabled={!getOrderId(order) || printingReceipt}>Fiş Yazdır</button>
                    <button className="btn saleCartFooterActionBtn" type="button" onClick={openReceiptPreview} disabled={!getOrderId(order)}>Fişi Gör</button>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Ödeme Al" dialogStyle={{ width: 'min(700px, calc(100vw - 32px))' }} bodyStyle={{ paddingTop: 10, paddingInline: 16, paddingBottom: 14 }}>
      <div className="payment-modal-stack">
        <div className="payment-meta-line">
          Masasız Satış — {order?.customerName || 'Misafir'} • {order?.orderNo ? `Sipariş ${order.orderNo}` : `Sipariş #${(order?.id || '').slice(-6)}`}
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
            {canEditEntryDate ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <SalesEntryDateButton
                  value={paymentEntryDate}
                  onChange={(value) => setPaymentEntryDate(writeSalesEntryDate(value))}
                  title="Ödeme tarihini seç"
                />
              </div>
            ) : null}
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

    <Modal open={branchPickerOpen} onClose={() => setBranchPickerOpen(false)} title="Sipariş Şubesi Seç">
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="card" style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}>
          <div style={{ fontWeight: 700, color: '#1d4ed8' }}>Siparişi hangi şubeye gireceğinizi seçin</div>
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>
            Ana kullanıcıda tüm masalar görünür; yeni hızlı satış ve paket sipariş için önce işlem yapılacak şube seçilir.
          </div>
        </div>
        {branchPickerLoading ? <div style={{ color: 'var(--muted)' }}>Şubeler yükleniyor...</div> : null}
        {!!branchPickerError ? <div style={{ color: '#b91c1c' }}>{branchPickerError}</div> : null}
        {!branchPickerLoading && !branchPickerError && availableBranches.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>Kullanılabilir şube bulunamadı.</div>
        ) : null}
        <div style={{ display: 'grid', gap: 8 }}>
          {availableBranches.map((branch) => {
            const branchId = String(branch?._id || branch?.id || '').trim()
            return (
              <button
                key={branchId}
                className="btn"
                type="button"
                onClick={async () => {
                  try {
                    localStorage.setItem('selectedBranchId', branchId)
                    setSelectedBranchId(branchId)
                    window.dispatchEvent(new CustomEvent('selected_branch_changed', { detail: { branchId } }))
                  } catch {}
                  setBranchPickerOpen(false)
                  await api('/api/pos/walkin/orders', {
                    method: 'POST',
                    data: { customerName: 'Misafir', note: '', entryDate },
                    branchIdOverride: branchId,
                    silent: true
                  }).then((res) => {
                    const fresh = pickOrder(res)
                    const newId = getOrderId(fresh)
                    if (!newId) {
                      toast.error('Sipariş başlatılamadı')
                      return
                    }
                    nav(`/kermes/app/walkin/${newId}`)
                  }).catch((err) => {
                    toast.error(err?.data?.message || err?.message || 'Sunucu hatası. Tekrar deneyin.')
                  })
                }}
                disabled={branchPickerLoading || !branchId}
                style={{ justifyContent: 'space-between', display: 'flex' }}
              >
                <span>{branch?.name || 'Şube'}</span>
                <span style={{ color: 'var(--muted)' }}>{branchId === selectedBranchId ? 'Seçili' : 'Seç'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>

    </div>
  )
}
