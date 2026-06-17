import React, { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'
import { useBusinessSettings } from '../../context/BusinessSettingsContext.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import useCanteenAutoRefresh from '../hooks/useCanteenAutoRefresh.js'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import useVirtualProductGrid from '../../hooks/useVirtualProductGrid.js'
import { diffPerfCounter, getPerfNow, incrementPerfCounter, isPerfDebugEnabled, isProductImagesDisabled, logPerf, markPerfEnd, markPerfStart, snapshotPerfCounter } from '../../lib/perfDebug.js'
import { resolveProductImageUrl } from '../../lib/productImage.js'
import { Barcode, Search } from 'lucide-react'

const IMAGE_PLACEHOLDER = '/images/product-placeholder.png'
const CASHIER_CART_STORAGE_KEY = 'canteen_cashier_cart_v1'

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const roundMoney = (n) => Number(Number(n || 0).toFixed(2))

const normalize = (s) => String(s || '').toLowerCase().trim()
const normalizeId = (value) => String(value || '').trim()
const normalizePaymentType = (method = {}) => {
  const type = String(method?.type || method?.bucket || method?.methodType || '').trim().toLowerCase()
  if (type === 'credit' || type === 'account') return 'account'
  if (type === 'card' || type === 'pos') return 'pos'
  if (type === 'bank') return 'bank'
  if (type === 'cash') return 'cash'
  return 'other'
}

const CashierCategoryRail = memo(function CashierCategoryRail({
  categories,
  activeCategoryId,
  onSelectCategory,
  showImages = true
}) {
  incrementPerfCounter('sidebarRenders', 'CanteenCashierCategoryRail')
  return (
    <div className="kasaCategoryColumn kasaCategoryRail">
      {categories.map((category) => {
        const isActive = String(activeCategoryId) === String(category.id)
        return (
          <button
            key={category.id}
            type="button"
            className="kasaCategoryCard"
            data-active={isActive ? 'true' : 'false'}
            data-has-image={showImages ? 'true' : 'false'}
            onClick={() => onSelectCategory(String(category.id))}
          >
            {showImages ? (
              <img
                className="kasaCategoryCardImage"
                src={resolveProductImageUrl({ imageUrl: category.imageUrl || IMAGE_PLACEHOLDER })}
                alt={category.name}
                loading="lazy"
                decoding="async"
                width="92"
                height="92"
                onError={(event) => { event.currentTarget.src = IMAGE_PLACEHOLDER }}
              />
            ) : null}
            <div className="kasaCategoryCardBody">
              <span>{category.name}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}, (prev, next) => (
  prev.categories === next.categories &&
  String(prev.activeCategoryId || '') === String(next.activeCategoryId || '')
))

const CashierProductCard = memo(function CashierProductCard({
  product,
  branchName,
  onAdd,
  style,
  themeText,
  accentText,
  measureRef = null,
  showImage = true
}) {
  const hasImage = String(product?.imageUrl || '').trim().length > 0
  const disableImages = isProductImagesDisabled()
  const productId = normalizeId(product?.id || product?._id)
  const handleClick = useCallback(() => onAdd(product), [onAdd, product])
  const handleImageError = useCallback((event) => {
    event.currentTarget.style.display = 'none'
    const placeholder = event.currentTarget.nextElementSibling
    if (placeholder) placeholder.style.display = 'grid'
  }, [])
  incrementPerfCounter('cashierProductCardRenders', productId || 'unknown')

  return (
    <button
      ref={measureRef}
      type="button"
      className="card kasaProductCard"
      data-has-image={showImage && hasImage && !disableImages ? 'true' : 'false'}
      onClick={handleClick}
      style={{ ...style, cursor: 'pointer', textAlign: 'left', display: 'grid', gap: 6 }}
    >
      {showImage && hasImage && !disableImages ? (
        <img
          className="kasaProductCardImage"
          src={resolveProductImageUrl({ imageUrl: product.imageUrl })}
          alt={product.name}
          loading="lazy"
          decoding="async"
          width="144"
          height="144"
          onError={handleImageError}
        />
      ) : null}
      <div className="kasaProductCardBody">
        <div className="kasaProductCardTitle" style={{ color: themeText }}>{product.name}</div>
        {product.categoryName ? (
          <div className="kasaProductCardMeta" style={{ color: accentText }}>
            {product.categoryName}
          </div>
        ) : null}
        {branchName ? (
          <div className="kasaProductCardMeta" style={{ color: accentText }}>
            {branchName}
          </div>
        ) : null}
        <div className="kasaProductCardFooter">
          <div className="kasaProductCardPrice" style={{ color: accentText }}>{money(product.price)} ₺</div>
          <div className="kasaProductCardStock">
            {product.stockTrackingEnabled === true ? `Stok: ${Number(product.stockQty || 0)}` : 'Stok: —'}
          </div>
        </div>
      </div>
    </button>
  )
}, (prev, next) => {
  const prevProduct = prev.product || {}
  const nextProduct = next.product || {}
  return (
    prev.onAdd === next.onAdd &&
    prev.style === next.style &&
    prev.themeText === next.themeText &&
    prev.accentText === next.accentText &&
    prev.measureRef === next.measureRef &&
    prev.showImage === next.showImage &&
    prev.branchName === next.branchName &&
    normalizeId(prevProduct.id || prevProduct._id) === normalizeId(nextProduct.id || nextProduct._id) &&
    String(prevProduct.name || '') === String(nextProduct.name || '') &&
    String(prevProduct.imageUrl || '') === String(nextProduct.imageUrl || '') &&
    String(prevProduct.categoryName || '') === String(nextProduct.categoryName || '') &&
    Number(prevProduct.price || 0) === Number(nextProduct.price || 0) &&
    Number(prevProduct.stockQty || 0) === Number(nextProduct.stockQty || 0) &&
    prevProduct.stockTrackingEnabled === nextProduct.stockTrackingEnabled
  )
})

export default function CanteenCashierPage() {
  const { getSetting } = useBusinessSettings()
  const perfDebugEnabled = isPerfDebugEnabled()
  const { me, session } = useOutletContext()
  const { theme, themeKey } = useTheme()
  const { isMobilePortrait } = useResponsiveFlags()
  const showMobileProductImages = getSetting('catalogView.showProductImage', false) === true
  const showProductImages = !isMobilePortrait || showMobileProductImages
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [q, setQ] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [barcode, setBarcode] = useState('')
  const [cart, setCart] = useState([])
  const [payMethod, setPayMethod] = useState('cash')
  const [paymentMethods, setPaymentMethods] = useState([])
  const [payNote, setPayNote] = useState('')
  const [saleNote, setSaleNote] = useState('')
  const [payAccordionOpen, setPayAccordionOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountDraft, setDiscountDraft] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [openNewCustomer, setOpenNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastSale, setLastSale] = useState(null)

  const customerAbortRef = useRef(null)
  const lastCustomerKeyRef = useRef('')
  const cartHydratedRef = useRef(false)
  const cartHydratedBranchRef = useRef('')

  const barcodeInputRef = useRef(null)
  const scanInFlightRef = useRef(new Set())
  const scanCountsRef = useRef(new Map())
  const errorTimerRef = useRef(null)
  const scanBufRef = useRef('')
  const scanLastAtRef = useRef(0)
  const scanSessionRef = useRef(false)
  const scanTimerRef = useRef(null)
  const scanConfirmTimerRef = useRef(null)
  const scanRestoreRef = useRef(null)
  const scanBarcodeRef = useRef(null)
  const productsApiCallCountRef = useRef(0)
  const categoryPerfRef = useRef(null)
  const cartRenderSnapshotRef = useRef({})
  const lastCartSignatureRef = useRef('')
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    try {
      return String(localStorage.getItem('selectedBranchId_canteen') || '')
    } catch {
      return ''
    }
  })

  const [branchModalOpen, setBranchModalOpen] = useState(false)

  incrementPerfCounter('pageRenders', 'CanteenCashierPage')

  const softProductCardStyle = useMemo(() => {
    const borderColor = theme.border
    const accentRgb = (() => {
      const hex = String(theme.accent || '').replace('#', '')
      if (hex.length !== 6) return '17,24,39'
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return `${r}, ${g}, ${b}`
    })()
    return {
      borderColor,
      background: `linear-gradient(180deg, ${theme.accentSoft} 0%, rgba(${accentRgb}, ${themeKey === 'mono' ? '0.05' : '0.1'}) 100%)`,
      boxShadow: `0 14px 34px rgba(${accentRgb}, ${themeKey === 'mono' ? '0.08' : '0.12'})`
    }
  }, [theme, themeKey])

  const scheduleBarcodeFocus = (delayMs = 250) => {
    setTimeout(() => {
      const el = (() => {
        try { return document.activeElement } catch { return null }
      })()
      const tag = String(el?.tagName || '').toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable
      if (isEditable) return
      if (!String(selectedBranchId || '').trim()) return
      if (branchModalOpen) return
      try { barcodeInputRef.current?.focus() } catch {}
    }, delayMs)
  }

  const allowedBranches = Array.isArray(session?.allowedBranches) ? session.allowedBranches : []
  const allowedIds = Array.isArray(session?.allowedBranchIds) ? session.allowedBranchIds.map(String).filter(Boolean) : []
  const sessionDefaultBranchId = String(
    session?.defaultBranchId ||
    session?.activeBranch?.id ||
    session?.branchId ||
    ''
  ).trim()

  const canPos = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('canteen_pos_access'))

  const loadProducts = async (options = {}) => {
    const background = options?.background === true
    productsApiCallCountRef.current += 1
    logPerf('CanteenCashierPage', 'products-request', {
      requestCount: productsApiCallCountRef.current,
      background,
      activeCategoryId: String(activeCategoryId || '')
    })
    if (!background) setLoadingProducts(true)
    if (!background) setError('')
    const qs = allowedIds.length > 0 ? `?branchIds=${encodeURIComponent(allowedIds.join(','))}` : ''
    const res = await api(`/api/canteen/products${qs}`, { silent: true })
    setProducts(Array.isArray(res?.products) ? res.products : [])
    if (!background) setLoadingProducts(false)
  }

  useEffect(() => {
    loadProducts()
  }, [session?.allowedBranchIds])

  const loadPaymentMethods = async () => {
    const res = await api('/api/settings/payment-methods', { silent: true })
    const methods = Array.isArray(res?.paymentMethods) ? res.paymentMethods : []
    const enabled = methods
      .filter((method) => method?.enabled === true && method?.isDeleted !== true)
      .map((method) => ({
        id: String(method.id || method.key || ''),
        name: String(method.name || method.label || ''),
        type: normalizePaymentType(method),
        isDefault: method?.isDefault === true,
      }))
      .filter((method) => method.id && method.name)
    setPaymentMethods(enabled)
    if (enabled.length === 0) return
    const current = enabled.find((method) => method.id === payMethod)
    if (current) return
    const nextDefault = enabled.find((method) => method.isDefault) || enabled[0]
    setPayMethod(nextDefault.id)
  }

  useEffect(() => {
    loadPaymentMethods()
  }, [])
  useCanteenAutoRefresh(() => {
    loadProducts({ background: true })
  }, [session?.allowedBranchIds], { enabled: canPos, intervalMs: 15000 })

  const selectedPayMethod = useMemo(() => {
    return paymentMethods.find((method) => method.id === payMethod) || null
  }, [paymentMethods, payMethod])

  const selectedPayMethodType = selectedPayMethod?.type || 'cash'

  useEffect(() => {
    const handler = () => {
      try {
        setSelectedBranchId(String(localStorage.getItem('selectedBranchId_canteen') || ''))
      } catch {
        setSelectedBranchId('')
      }
    }
    window.addEventListener('canteen_branch_changed', handler)
    return () => window.removeEventListener('canteen_branch_changed', handler)
  }, [])

  useEffect(() => {
    const current = String(selectedBranchId || '').trim()
    if (current && allowedIds.includes(current)) return
    const preferred = sessionDefaultBranchId && allowedIds.includes(sessionDefaultBranchId)
      ? sessionDefaultBranchId
      : String(allowedIds[0] || '').trim()
    const v = String(preferred || '').trim()
    if (!v) return
    try { localStorage.setItem('selectedBranchId_canteen', v) } catch {}
    setSelectedBranchId(v)
  }, [allowedIds, selectedBranchId, sessionDefaultBranchId])

  useEffect(() => {
    if (String(selectedBranchId || '').trim()) {
      setBranchModalOpen(false)
      return
    }
    if (allowedIds.length > 1) {
      setBranchModalOpen(true)
    }
  }, [allowedIds.length, selectedBranchId])

  const categories = useMemo(() => {
    const groups = new Map()
    products.forEach((product) => {
      const id = String(product?.categoryId || '').trim()
      const name = String(product?.categoryName || '').trim()
      if (!id || !name) return
      const current = groups.get(id)
      if (current) {
        current.count += 1
        if (!current.imageUrl && product?.categoryImageUrl) current.imageUrl = String(product.categoryImageUrl)
        return
      }
      groups.set(id, {
        id,
        name,
        count: 1,
        imageUrl: String(product?.categoryImageUrl || product?.imageUrl || '')
      })
    })
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [products])

  const cartProductMap = useMemo(() => {
    const map = new Map()
    products.forEach((product) => {
      const id = String(product?.id || product?._id || '').trim()
      if (!id) return
      map.set(id, product)
    })
    return map
  }, [products])

  useEffect(() => {
    if (!categories.length) {
      setActiveCategoryId('')
      return
    }
    if (categories.some((category) => String(category.id) === String(activeCategoryId))) return
    setActiveCategoryId(String(categories[0]?.id || ''))
  }, [activeCategoryId, categories])

  const filteredProducts = useMemo(() => {
    const nq = normalize(q)
    const nextProducts = products.filter((product) => {
      const matchesCategory = !String(activeCategoryId || '').trim()
        ? true
        : activeCategoryId === 'uncategorized'
          ? !String(product?.categoryId || '').trim()
          : String(product?.categoryId || '') === String(activeCategoryId)
      if (!matchesCategory) return false
      if (!nq) return true
      return [product?.name, product?.categoryName, product?.barcode].some((value) => normalize(value).includes(nq))
    })
    logPerf('CanteenCashierPage', 'filter-result', {
      activeCategoryId: String(activeCategoryId || ''),
      searchQuery: String(q || ''),
      totalProducts: products.length,
      filteredCount: nextProducts.length
    })
    return nextProducts
  }, [activeCategoryId, products, q])

  const {
    containerRef: productScrollRef,
    gridMeasureRef: productGridMeasureRef,
    cardMeasureRef: productCardMeasureRef,
    handleScroll: handleProductScroll,
    visibleItems: visibleProducts,
    topSpacer: topProductSpacer,
    bottomSpacer: bottomProductSpacer,
    isVirtualized: productsVirtualized,
    debugState: productGridDebug
  } = useVirtualProductGrid({
    items: filteredProducts,
    enabled: isMobilePortrait,
    debugKey: 'CanteenCashierPage',
    resetDeps: [activeCategoryId, q, selectedBranchId]
  })

  const branchNameById = useMemo(() => {
    const map = new Map()
    allowedBranches.forEach((branch) => {
      const id = normalizeId(branch?.id)
      if (!id) return
      map.set(id, String(branch?.name || ''))
    })
    return map
  }, [allowedBranches])

  const handleCategorySelect = useCallback((categoryId) => {
    categoryPerfRef.current = {
      categoryId: String(categoryId || ''),
      startedAt: getPerfNow(),
      apiRequestCountBefore: productsApiCallCountRef.current
    }
    markPerfStart('CanteenCashierPage', 'category-change', {
      categoryId: String(categoryId || ''),
      previousCategoryId: String(activeCategoryId || '')
    })
    startTransition(() => {
      setActiveCategoryId(String(categoryId || ''))
    })
  }, [activeCategoryId])

  const handleQueryChange = useCallback((value) => {
    startTransition(() => {
      setQ(value)
    })
  }, [])

  useEffect(() => {
    if (!perfDebugEnabled) return
    if (!categoryPerfRef.current) return
    const renderedDomCount = productScrollRef.current
      ? productScrollRef.current.querySelectorAll('.kasaProductCard').length
      : 0
    const elapsedMs = markPerfEnd('CanteenCashierPage', 'category-change', {
      categoryId: String(activeCategoryId || ''),
      filteredCount: filteredProducts.length,
      visibleCount: visibleProducts.length,
      renderedDomCount,
      apiRequestsDuringChange: productsApiCallCountRef.current - Number(categoryPerfRef.current.apiRequestCountBefore || 0)
    })
    logPerf('CanteenCashierPage', 'category-change-summary', {
      elapsedMs,
      activeCategoryId: String(activeCategoryId || ''),
      filteredCount: filteredProducts.length,
      visibleCount: visibleProducts.length,
      renderedDomCount
    })
    categoryPerfRef.current = null
  }, [activeCategoryId, filteredProducts.length, perfDebugEnabled, productScrollRef, visibleProducts.length])

  useEffect(() => {
    if (!isMobilePortrait || !perfDebugEnabled || !productGridDebug) return
    const frame = requestAnimationFrame(() => {
      const renderedDomCount = productScrollRef.current
        ? productScrollRef.current.querySelectorAll('.kasaProductCard').length
        : 0
      logPerf('CanteenCashierPage', 'virtual-grid-dom', {
        ...productGridDebug,
        renderedDomCount
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [isMobilePortrait, perfDebugEnabled, productGridDebug, productScrollRef])

  useEffect(() => {
    const branchId = String(selectedBranchId || '').trim()
    cartHydratedRef.current = false
    cartHydratedBranchRef.current = branchId
    if (!branchId) {
      setCart([])
      cartHydratedRef.current = true
      return
    }
    try {
      const raw = localStorage.getItem(CASHIER_CART_STORAGE_KEY)
      if (!raw) {
        setCart([])
        return
      }
      const parsed = JSON.parse(raw)
      const byBranch = parsed && typeof parsed === 'object' ? parsed : {}
      const saved = Array.isArray(byBranch[branchId]) ? byBranch[branchId] : []
      const restored = saved
        .map((item) => {
          const productId = String(item?.productId || '').trim()
          if (!productId) return null
          const qty = Math.max(1, Number(item?.qty || 0))
          return {
            productId,
            name: String(item?.name || ''),
            barcode: String(item?.barcode || ''),
            unitPrice: Number(item?.unitPrice || 0),
            qty,
            productBranchId: String(item?.productBranchId || branchId)
          }
        })
        .filter(Boolean)
      setCart(restored)
    } catch {
      setCart([])
    } finally {
      cartHydratedRef.current = true
    }
  }, [selectedBranchId])

  useEffect(() => {
    if (cartHydratedBranchRef.current !== String(selectedBranchId || '').trim()) return
    if (cartProductMap.size === 0) return
    setCart((prev) => prev.map((item) => {
      const product = cartProductMap.get(String(item?.productId || '').trim())
      if (!product) return item
      const nextName = String(product?.name || item?.name || '')
      const nextBarcode = String(product?.barcode || item?.barcode || '')
      const nextPrice = Number(product?.price ?? item?.unitPrice ?? 0)
      const nextBranchId = String(product?.branchId || item?.productBranchId || selectedBranchId || '')
      if (
        nextName === String(item?.name || '') &&
        nextBarcode === String(item?.barcode || '') &&
        nextPrice === Number(item?.unitPrice || 0) &&
        nextBranchId === String(item?.productBranchId || '')
      ) {
        return item
      }
      return {
        ...item,
        name: nextName,
        barcode: nextBarcode,
        unitPrice: nextPrice,
        productBranchId: nextBranchId
      }
    }))
  }, [cartProductMap, selectedBranchId])

  useEffect(() => {
    const branchId = String(selectedBranchId || '').trim()
    if (!branchId) return
    if (!cartHydratedRef.current) return
    try {
      const raw = localStorage.getItem(CASHIER_CART_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      const next = parsed && typeof parsed === 'object' ? parsed : {}
      next[branchId] = cart.map((item) => ({
        productId: String(item?.productId || ''),
        name: String(item?.name || ''),
        barcode: String(item?.barcode || ''),
        unitPrice: Number(item?.unitPrice || 0),
        qty: Math.max(1, Number(item?.qty || 0)),
        productBranchId: String(item?.productBranchId || branchId)
      }))
      localStorage.setItem(CASHIER_CART_STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [cart, selectedBranchId])

  useEffect(() => {
    const nextSignature = JSON.stringify(
      cart.map((item) => ({
        id: String(item?.productId || ''),
        qty: Number(item?.qty || 0)
      }))
    )
    if (!lastCartSignatureRef.current) {
      lastCartSignatureRef.current = nextSignature
      cartRenderSnapshotRef.current = snapshotPerfCounter('cashierProductCardRenders')
      return
    }
    if (lastCartSignatureRef.current === nextSignature) return
    const delta = diffPerfCounter('cashierProductCardRenders', cartRenderSnapshotRef.current)
    const visibleIds = new Set(visibleProducts.map((item) => normalizeId(item?.id || item?._id)))
    const affectedVisibleCards = delta.changed.filter((entry) => visibleIds.has(normalizeId(entry.key)))
    logPerf('CanteenCashierPage', 'cart-change-rerenders', {
      visibleCardRerenderCount: affectedVisibleCards.length,
      visibleCardIds: affectedVisibleCards.map((entry) => entry.key),
      totalChangedCards: delta.changed.length
    })
    lastCartSignatureRef.current = nextSignature
    cartRenderSnapshotRef.current = delta.current
  }, [cart, visibleProducts])

  const total = useMemo(() => {
    return cart.reduce((sum, it) => sum + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
  }, [cart])
  const discountInputValue = String(discountDraft ?? '').replace(',', '.').trim()
  const parsedDiscountPercent = Number(discountInputValue === '' ? '0' : discountInputValue)
  const discountPercent = Number.isFinite(parsedDiscountPercent)
    ? Math.max(0, Math.min(100, parsedDiscountPercent))
    : 0
  const discountTotal = roundMoney((Number(total || 0) * discountPercent) / 100)
  const netTotal = roundMoney(Math.max(0, Number(total || 0) - discountTotal))

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, it) => sum + Number(it.qty || 0), 0)
  }, [cart])

  const cartBranchIds = useMemo(() => {
    const ids = cart.map(it => String(it.productBranchId || '')).filter(Boolean)
    return Array.from(new Set(ids))
  }, [cart])

  const addToCart = useCallback((p, qtyAdd = 1) => {
    const id = String(p?.id || p?._id || '')
    if (!id) return
    const addQty = Math.max(1, Number(qtyAdd || 1))
    setCart(prev => {
      const next = prev.map(x => ({ ...x }))
      const idx = next.findIndex(x => x.productId === id)
      if (idx >= 0) {
        next[idx].qty += addQty
        return next
      }
      next.unshift({ productId: id, name: p.name, barcode: String(p.barcode || ''), unitPrice: Number(p.price || 0), qty: addQty, productBranchId: p?.branchId ? String(p.branchId) : null })
      return next
    })
  }, [])

  const scanBarcode = async (raw, opts = {}) => {
    const code = String(raw || '').trim()
    if (!code) return
    if (!String(selectedBranchId || '').trim()) return

    const final = opts?.final === true

    if (cart.some(it => String(it.barcode || '').trim() === code)) {
      setCart(prev => prev.map(it => String(it.barcode || '').trim() === code ? { ...it, qty: Number(it.qty || 0) + 1 } : it))
      return
    }

    const prevCount = scanCountsRef.current.get(code) || 0
    scanCountsRef.current.set(code, prevCount + 1)
    if (scanInFlightRef.current.has(code)) return
    scanInFlightRef.current.add(code)

    try {
      const res = await api(`/api/canteen/products/by-barcode/${encodeURIComponent(code)}`, { silent: true, headers: { 'x-branch-id': String(selectedBranchId) } })
      if (!res?.ok || !res?.product) {
        if (final && res?.code === 'not_found') {
          setError('Barkod bulunamadı')
          try { clearTimeout(errorTimerRef.current) } catch {}
          errorTimerRef.current = setTimeout(() => setError(''), 2000)
        }
        scanCountsRef.current.delete(code)
        return
      }
      const times = Number(scanCountsRef.current.get(code) || 1)
      scanCountsRef.current.delete(code)
      addToCart({ ...res.product, branchId: String(selectedBranchId) }, times)
    } finally {
      scanInFlightRef.current.delete(code)
    }
  }

  scanBarcodeRef.current = scanBarcode

  const resetScanSession = () => {
    scanBufRef.current = ''
    scanLastAtRef.current = 0
    scanSessionRef.current = false
    scanRestoreRef.current = null
    try { clearTimeout(scanTimerRef.current) } catch {}
    scanTimerRef.current = null
    try { clearTimeout(scanConfirmTimerRef.current) } catch {}
    scanConfirmTimerRef.current = null
  }

  const restoreToTarget = () => {
    const snap = scanRestoreRef.current
    const buf = String(scanBufRef.current || '')
    if (!snap || !buf) return
    const el = snap.el
    const tag = String(el?.tagName || '').toLowerCase()
    if (tag !== 'input' && tag !== 'textarea') return
    try {
      const cur = String(snap.value || '')
      const start = Number(snap.start || 0)
      const end = Number(snap.end || 0)
      const next = cur.slice(0, start) + buf + cur.slice(end)
      el.value = next
      const caret = start + buf.length
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(caret, caret)
      try { el.dispatchEvent(new Event('input', { bubbles: true })) } catch {}
    } catch {}
  }

  const finalizeScan = (buffer) => {
    const code = String(buffer || '').trim()
    if (!/^[0-9]+$/.test(code)) return
    if (code.length < 8 || code.length > 32) return
    setBarcode('')
    scanBarcodeRef.current?.(code, { source: 'scanner', final: true })
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return
      if (e.ctrlKey || e.metaKey || e.altKey) {
        resetScanSession()
        return
      }

      const target = e.target
      if (target?.dataset?.allowManualNumeric === 'true') {
        resetScanSession()
        return
      }

      const now = Date.now()
      const key = String(e.key || '')
      const isEnter = key === 'Enter'
      const isEscape = key === 'Escape'
      const isChar = key.length === 1
      const isDigit = isChar && key >= '0' && key <= '9'

      const idleMs = 110
      const sessionStartMs = 50
      const humanBreakMs = 70

      if (isEscape) {
        resetScanSession()
        return
      }

      if (isEnter && scanSessionRef.current === true) {
        e.preventDefault()
        e.stopPropagation()
        const buf = String(scanBufRef.current || '')
        resetScanSession()
        finalizeScan(buf)
        return
      }

      if (!isDigit) {
        if (scanSessionRef.current === true && String(scanBufRef.current || '').length > 0) {
          const bufLen = String(scanBufRef.current || '').length
          if (bufLen < 8) restoreToTarget()
          resetScanSession()
        }
        return
      }

      const delta = scanLastAtRef.current ? now - scanLastAtRef.current : 0
      const shouldStartOrContinue = scanSessionRef.current === true || (scanLastAtRef.current > 0 && delta < sessionStartMs)

      if (!shouldStartOrContinue) {
        scanBufRef.current = ''
        scanLastAtRef.current = now
        scanSessionRef.current = true
        const tag = String(e.target?.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea') {
          try {
            scanRestoreRef.current = {
              el: e.target,
              value: String(e.target.value || ''),
              start: Number(e.target.selectionStart || 0),
              end: Number(e.target.selectionEnd || 0)
            }
          } catch {
            scanRestoreRef.current = null
          }
        } else {
          scanRestoreRef.current = null
        }

        e.preventDefault()
        e.stopPropagation()
        scanBufRef.current += key

        try { clearTimeout(scanConfirmTimerRef.current) } catch {}
        scanConfirmTimerRef.current = setTimeout(() => {
          if (scanSessionRef.current !== true) return
          if (String(scanBufRef.current || '').length >= 2) return
          restoreToTarget()
          resetScanSession()
        }, sessionStartMs)

        try { clearTimeout(scanTimerRef.current) } catch {}
        scanTimerRef.current = setTimeout(() => {
          if (scanSessionRef.current !== true) return
          const buf = String(scanBufRef.current || '')
          if (buf.length >= 8) finalizeScan(buf)
          else restoreToTarget()
          resetScanSession()
        }, idleMs)
        return
      }

      if (scanSessionRef.current === true && delta && delta > humanBreakMs) {
        restoreToTarget()
        resetScanSession()
        return
      }

      scanSessionRef.current = true
      scanLastAtRef.current = now

      e.preventDefault()
      e.stopPropagation()
      scanBufRef.current += key
      if (scanBufRef.current.length > 32) scanBufRef.current = scanBufRef.current.slice(-32)

      try { clearTimeout(scanConfirmTimerRef.current) } catch {}
      scanConfirmTimerRef.current = null

      try { clearTimeout(scanTimerRef.current) } catch {}
      scanTimerRef.current = setTimeout(() => {
        if (scanSessionRef.current !== true) return
        const buf = String(scanBufRef.current || '')
        if (buf.length >= 8) finalizeScan(buf)
        else restoreToTarget()
        resetScanSession()
      }, idleMs)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const activeBranchName = useMemo(() => {
    const id = String(selectedBranchId || '').trim()
    if (!id) return ''
    return String(allowedBranches.find(b => String(b.id) === id)?.name || '')
  }, [allowedBranches, selectedBranchId])

  const inc = useCallback((productId) => {
    setCart(prev => prev.map(it => it.productId === productId ? { ...it, qty: Number(it.qty || 0) + 1 } : it))
  }, [])

  const dec = useCallback((productId) => {
    setCart(prev => {
      const next = prev.map(it => it.productId === productId ? { ...it, qty: Number(it.qty || 0) - 1 } : it)
      return next.filter(it => Number(it.qty || 0) > 0)
    })
  }, [])

  const setQty = useCallback((productId, nextQty) => {
    const raw = String(nextQty ?? '').replace(/[^\d]/g, '')
    const qty = raw === '' ? 0 : Math.floor(Number(raw))
    setCart(prev => {
      if (!Number.isFinite(qty) || qty < 0) return prev
      return prev.map(it => it.productId === productId ? { ...it, qty } : it)
    })
  }, [])

  const removeLine = useCallback((productId) => {
    setCart(prev => prev.filter(it => it.productId !== productId))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerQuery(String(customerQuery || '').trim()), 350)
    return () => clearTimeout(t)
  }, [customerQuery])

  useEffect(() => {
    if (selectedPayMethodType !== 'account') return
    const term = String(debouncedCustomerQuery || '').trim()

    if (term.length < 2) {
      setCustomers([])
      setLoadingCustomers(false)
      lastCustomerKeyRef.current = ''
      try { customerAbortRef.current?.abort() } catch {}
      customerAbortRef.current = null
      return
    }

    const key = `customers:${term.toLowerCase()}`
    if (lastCustomerKeyRef.current === key) return
    lastCustomerKeyRef.current = key

    try { customerAbortRef.current?.abort() } catch {}
    const controller = new AbortController()
    customerAbortRef.current = controller
    setLoadingCustomers(true)

    api(`/api/canteen/customers?q=${encodeURIComponent(term)}`, { silent: true, signal: controller.signal })
      .then((res) => {
        setCustomers(Array.isArray(res?.customers) ? res.customers : [])
        setLoadingCustomers(false)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          try { console.debug('[CANTEEN_CUSTOMER_SEARCH_ERR]', err) } catch {}
        }
        setLoadingCustomers(false)
      })

    return () => {
      try { controller.abort() } catch {}
    }
  }, [debouncedCustomerQuery, selectedPayMethodType])

  const submitNewCustomer = async () => {
    const name = String(newCustomerName || '').trim()
    if (!name) return
    const res = await api('/api/canteen/customers', {
      method: 'POST',
      data: { name, phone: String(newCustomerPhone || '').trim() },
      silent: true
    })
    if (res?.ok && res?.customer?.id) {
      setCustomerId(String(res.customer.id))
      setOpenNewCustomer(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
      setCustomerQuery(String(name))
    } else {
      setError(res?.message || 'Cari eklenemedi')
    }
  }

  const completeSale = async () => {
    if (cart.length === 0) return
    if (selectedPayMethodType === 'account' && !customerId) {
      setError('Cari seçmelisin')
      return
    }
    const missingBranch = cart.find(it => !String(it.productBranchId || '').trim())
    if (missingBranch) {
      setError('Ürün şubesi bulunamadı. Listeyi yenileyip tekrar deneyin.')
      return
    }

    const saleCart = cart.filter(it => Number(it.qty || 0) > 0)
    if (saleCart.length === 0) {
      setError('Sepette satışa uygun ürün yok')
      return
    }

    const groups = new Map()
    for (const it of saleCart) {
      const bid = String(it.productBranchId || '').trim()
      if (!bid) continue
      if (!groups.has(bid)) groups.set(bid, [])
      groups.get(bid).push(it)
    }
    const branchIds = Array.from(groups.keys())
    if (branchIds.length === 0) return

    const totalsByBranch = branchIds.map(bid => ({
      branchId: bid,
      subTotal: groups.get(bid).reduce((sum, it) => sum + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
    }))

    const grand = totalsByBranch.reduce((sum, x) => sum + Number(x.subTotal || 0), 0)
    if (!Number.isFinite(grand) || grand <= 0) return

    let allocatedDiscount = 0
    const allocations = totalsByBranch.map((x, index) => {
      const branchSubTotal = roundMoney(Number(x.subTotal || 0))
      const branchDiscount = index === totalsByBranch.length - 1
        ? roundMoney(discountTotal - allocatedDiscount)
        : roundMoney((branchSubTotal * discountPercent) / 100)
      allocatedDiscount += branchDiscount
      const payAmount = roundMoney(Math.max(0, branchSubTotal - branchDiscount))
      return { ...x, discountPercent, discountTotal: branchDiscount, payAmount }
    })

    setSaving(true)
    setError('')
    setLastSale(null)

    const created = []
    const stockUpdatesAll = []
    for (const row of allocations) {
      const bid = row.branchId
      const items = (groups.get(bid) || []).map(it => ({ productId: it.productId, qty: Number(it.qty || 0) }))
      const payload = {
        items,
        discountPercent: row.discountPercent,
        payment: {
          method: payMethod,
          amount: row.payAmount,
          note: String(payNote || '').trim(),
          customerId: selectedPayMethodType === 'account' ? String(customerId) : undefined
        },
        note: String(saleNote || payNote || '').trim()
      }

      const res = await api(`/api/canteen/sales?branchId=${encodeURIComponent(String(bid))}`, { method: 'POST', data: payload, silent: true })
      if (!res?.ok || !res?.sale) {
        const bname = allowedBranches.find(b => String(b.id) === String(bid))?.name || bid
        setError(`${bname} satışında hata: ${res?.message || 'Satış oluşturulamadı'}`)
        setSaving(false)
        return
      }
      created.push({ branchId: bid, sale: res.sale })
      if (Array.isArray(res.sale?.stockUpdates)) {
        for (const u of res.sale.stockUpdates) {
          if (!u?.productId) continue
          stockUpdatesAll.push({ branchId: String(bid), productId: String(u.productId), stockQty: Number(u.stockQty || 0) })
        }
      }
      if (import.meta.env.DEV) {
        try { console.debug('[CANTEEN_SALE_CREATED]', { branchId: bid, saleId: res.sale?.id }) } catch {}
      }
    }

    if (stockUpdatesAll.length > 0) {
      setProducts(prev => {
        const next = Array.isArray(prev) ? prev.map(p => ({ ...p })) : []
        for (const u of stockUpdatesAll) {
          const idx = next.findIndex(p => String(p.id || p._id || '') === String(u.productId) && String(p.branchId || '') === String(u.branchId))
          if (idx >= 0) next[idx].stockQty = Number(u.stockQty || 0)
        }
        return next
      })
    }

    const breakdown = created.map(x => {
      const bname = allowedBranches.find(b => String(b.id) === String(x.branchId))?.name || x.branchId
      return { branchId: x.branchId, name: bname, subTotal: Number(x.sale?.subTotal || 0), discountTotal: Number(x.sale?.discountTotal || 0), total: Number(x.sale?.total || 0), id: x.sale?.id }
    })
    try {
      const branchId = String(selectedBranchId || '').trim()
      if (branchId) {
        const raw = localStorage.getItem(CASHIER_CART_STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : {}
        const next = parsed && typeof parsed === 'object' ? parsed : {}
        next[branchId] = []
        localStorage.setItem(CASHIER_CART_STORAGE_KEY, JSON.stringify(next))
      }
    } catch {}
    setLastSale({ subTotal: total, discountTotal, total: netTotal, breakdown })
    setCart([])
    setPayNote('')
    setSaleNote('')
    setDiscountDraft('')
    setCustomerId('')
    setSaving(false)

    setTimeout(() => {
      const el = (() => {
        try { return document.activeElement } catch { return null }
      })()
      const tag = String(el?.tagName || '').toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable
      if (isEditable) return
      try { barcodeInputRef.current?.focus() } catch {}
    }, 200)
  }

  if (!canPos) return <div className="card">403 – Bu sayfaya yetkin yok</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {!!error && <div className="card" style={{ borderColor: 'color-mix(in srgb, #ef4444 38%, var(--app-border, var(--border)))', background: 'color-mix(in srgb, #ef4444 10%, var(--app-surface, var(--panel)))', color: 'color-mix(in srgb, #ef4444 78%, var(--app-text, var(--text)))' }}>{error}</div>}

      <div className="kasaLayout kasaShowcaseLayout">
        <div className="card kasaShowcasePanel" style={{ display: 'grid', gap: 10 }}>
          <label className="kasaSearchPrimary">
            <input
              className="input kasaSearchPrimaryInput"
              ref={barcodeInputRef}
              value={barcode}
              onChange={(e) => {
                const v = e.target.value
                setBarcode(v)
                if (error) setError('')
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const v = String(barcode || '').trim()
                setBarcode('')
                scanBarcode(v, { source: 'manual', final: true })
              }}
              placeholder="Barkod okut"
              inputMode="numeric"
            />
          </label>
          <label className="kasaSearchSecondary">
            <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Ürün ara</div>
            <input
              className="input kasaSearchSecondaryInput"
              value={q}
              onBlur={() => scheduleBarcodeFocus(250)}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Ürün adı"
            />
          </label>
          <div className="kasaCatalogLayout">
            <CashierCategoryRail
              categories={categories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={handleCategorySelect}
              showImages={showProductImages}
            />
            <div
              ref={productScrollRef}
              className="kasaProductGridScroll kasaProductVirtualScroll"
            >
              {productsVirtualized ? <div style={{ height: topProductSpacer }} aria-hidden="true" /> : null}
              <div ref={productGridMeasureRef} className="kasaProductGrid">
                {visibleProducts.map((p, index) => (
                  <CashierProductCard
                    key={p.id || p._id}
                    product={p}
                    branchName={branchNameById.get(normalizeId(p.branchId)) || ''}
                    onAdd={addToCart}
                    style={softProductCardStyle}
                    themeText={theme.text}
                    accentText={theme.accentText}
                    measureRef={isMobilePortrait && index === 0 ? productCardMeasureRef : null}
                    showImage={showProductImages}
                  />
                ))}
                {!loadingProducts && visibleProducts.length === 0 && <div style={{ color: 'var(--app-text-secondary, var(--muted))' }}>Ürün yok</div>}
              </div>
              {productsVirtualized ? <div style={{ height: bottomProductSpacer }} aria-hidden="true" /> : null}
            </div>
          </div>
        </div>

        <div className="kasaSidePanel" style={{ display: 'grid', gap: 12 }}>
          <div className="card kasaCartPanel" style={{ display: 'grid', gap: 10 }}>
            <div className="kasaCartPanelHead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Sepet</div>
              <div style={{ color: 'var(--app-text, var(--text))', fontSize: 18, fontWeight: 800 }}>Toplam: {money(total)} ₺</div>
            </div>

            <div className="kasaCartList order-cart-scroll scrollbar-hidden">
              {cart.map(it => (
                <div key={it.productId} className="kasaCartRow" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div className="kasaCartRowBody">
                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                    <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 12 }}>{money(it.unitPrice)} ₺</div>
                  </div>
                  <div className="kasaCartRowActions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="btn btn--compact" type="button" onClick={() => dec(it.productId)}>-</button>
                    <input
                      className="input"
                      type="text"
                      data-allow-manual-numeric="true"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={String(it.qty)}
                      onChange={(e) => setQty(it.productId, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => scheduleBarcodeFocus(250)}
                      style={{ width: 104, height: 36, textAlign: 'right', fontWeight: 700, padding: '6px 10px' }}
                    />
                    <button className="btn btn--compact" type="button" onClick={() => inc(it.productId)}>+</button>
                    <button className="btn btn--danger btn--compact" type="button" onClick={() => removeLine(it.productId)}>Sil</button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <div style={{ color: 'var(--app-text-secondary, var(--muted))' }}>Sepet boş</div>}
            </div>
          </div>

          <div className="card kasaPaymentPanel" style={{ display: 'grid', gap: '2mm' }}>
            <div className="kasaPaymentPanelHead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2mm', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>Ödeme Al</div>
              <button
                className="btn btn--compact kasaDiscountToggle"
                type="button"
                onClick={() => setDiscountOpen(v => !v)}
                aria-pressed={discountOpen}
                style={{ minWidth: 0 }}
              >
                {discountOpen ? 'İndirimi Gizle' : `İndirim ${discountPercent > 0 ? `%${discountPercent}` : ''}`.trim()}
              </button>
              <input
                className="input kasaPaymentHeadNote"
                value={payNote}
                onBlur={() => scheduleBarcodeFocus(250)}
                onChange={(e) => {
                  const v = e.target.value
                  setPayNote(v)
                  setSaleNote(v)
                }}
                placeholder="Not"
              />
              <button className="btn btn--compact onlyMobile" type="button" onClick={() => setPayAccordionOpen(v => !v)} aria-pressed={payAccordionOpen}>
                {payAccordionOpen ? 'Kapat' : 'Aç'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: '2mm' }} className={payAccordionOpen ? '' : 'onlyDesktop'}>
            {discountOpen && (
            <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--app-surface-soft, var(--panel))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Brüt</div>
                <div style={{ fontWeight: 700 }}>{money(total)} ₺</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>İndirim (%)</div>
                <input
                  className="input"
                  type="text"
                  inputMode="decimal"
                  data-allow-manual-numeric="true"
                  value={discountDraft}
                  placeholder="0"
                  onBlur={() => scheduleBarcodeFocus(250)}
                  onChange={(e) => setDiscountDraft(String(e.target.value ?? '').replace(',', '.'))}
                  style={{ width: 120, height: 36, textAlign: 'right', fontWeight: 700, padding: '6px 10px' }}
                  dir="ltr"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>İndirim Tutarı</div>
                <div style={{ fontWeight: 700 }}>{money(discountTotal)} ₺</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Net</div>
                <div style={{ fontWeight: 800, color: 'var(--theme-accent, #f59e0b)' }}>{money(netTotal)} ₺</div>
              </div>
            </div>
            )}
            {selectedPayMethodType === 'account' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <label>
                  <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Cari seç</div>
                  <input
                    className="input"
                    value={customerQuery}
                    onBlur={() => scheduleBarcodeFocus(250)}
                    onChange={(e) => {
                      const v = e.target.value
                      setCustomerQuery(v)
                    }}
                    placeholder="İsim veya telefon"
                  />
                </label>
                <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 6 }}>
                  {customers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="btn btn--full btn--between"
                      onClick={() => setCustomerId(String(c.id))}
                      data-active={customerId === String(c.id) ? 'true' : 'false'}
                      disabled={loadingCustomers}
                    >
                      <span>{c.name}</span>
                      <span style={{ color: 'var(--app-text-secondary, var(--muted))' }}>{c.phone || ''}</span>
                    </button>
                  ))}
                  {!loadingCustomers && String(debouncedCustomerQuery || '').trim().length < 2 && <div style={{ color: 'var(--app-text-secondary, var(--muted))' }}>Aramak için en az 2 karakter yaz</div>}
                  {!loadingCustomers && String(debouncedCustomerQuery || '').trim().length >= 2 && customers.length === 0 && <div style={{ color: 'var(--app-text-secondary, var(--muted))' }}>Cari yok</div>}
                </div>
                <button className="btn btn--primary" type="button" onClick={() => setOpenNewCustomer(true)}>+ Yeni cari ekle</button>
              </div>
            )}

            <label>
              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Not</div>
              <input
                className="input"
                value={payNote}
                onBlur={() => scheduleBarcodeFocus(250)}
                onChange={(e) => {
                  const v = e.target.value
                  setPayNote(v)
                  setSaleNote(v)
                }}
                placeholder="Ödeme notu"
              />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Satış notu</div>
              <input
                className="input"
                value={saleNote}
                onBlur={() => scheduleBarcodeFocus(250)}
                onChange={(e) => setSaleNote(e.target.value)}
                placeholder="Satış notu"
              />
            </label>

            <div className="kasaPaymentMethodGrid" role="group" aria-label="Odeme yontemleri">
              {paymentMethods.map((method) => {
                return (
                  <button
                    key={method.id}
                    type="button"
                    className="btn kasaPaymentMethodButton"
                    data-active={payMethod === method.id ? 'true' : 'false'}
                    onClick={() => setPayMethod(method.id)}
                  >
                    <span>{method.name}</span>
                  </button>
                )
              })}
            </div>

            <button className="btn btn--primary btn--large onlyDesktop kasaCheckoutButton" type="button" onClick={completeSale} disabled={saving || cart.length === 0}>
              {saving ? 'Kaydediliyor...' : 'Satışı tamamla'}
            </button>

            {lastSale && (
              <div className="card" style={{ background: '#ecfdf5', borderColor: '#bbf7d0' }}>
                <div style={{ fontWeight: 700, color: '#166534' }}>Satış tamamlandı</div>
                <div style={{ color: 'color-mix(in srgb, #22c55e 78%, var(--app-text, var(--text)))', fontSize: 13 }}>Toplam: {money(lastSale.total)} ₺</div>
                <div style={{ color: '#166534', fontSize: 13 }}>
                  {Array.isArray(lastSale.breakdown)
                    ? `Satış ${lastSale.breakdown.length} şubeye bölündü: ${lastSale.breakdown.map(x => `${x.name} ${money(x.total)}₺`).join(', ')}`
                    : ''}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <div className="onlyMobile stickyBottom kasaBottomBar" style={{ marginTop: 4 }}>
        <div className="kasaBottomBarInner">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div style={{ fontWeight: 800 }}>Toplam</div>
            <div style={{ fontWeight: 800 }}>{money(total)} ₺</div>
          </div>
          <button className="btn btn--primary btn--large" type="button" onClick={completeSale} disabled={saving || cart.length === 0}>
            {saving ? 'Kaydediliyor...' : 'Satışı tamamla'}
          </button>
        </div>
      </div>

      <Modal open={openNewCustomer} onClose={() => setOpenNewCustomer(false)} title="Yeni Cari">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Ad</div>
            <input
              className="input"
              value={newCustomerName}
              onBlur={() => scheduleBarcodeFocus(250)}
              onChange={(e) => setNewCustomerName(e.target.value)}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Telefon</div>
            <input
              className="input"
              value={newCustomerPhone}
              onBlur={() => scheduleBarcodeFocus(250)}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
            />
          </label>
          <div className="app-modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setOpenNewCustomer(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitNewCustomer} disabled={!String(newCustomerName || '').trim()}>Kaydet</button>
          </div>
        </div>
      </Modal>


      <Modal open={branchModalOpen} onClose={() => {}} title="Şube Seç">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 13 }}>Kasa için aktif şubeyi seç.</div>
          <select
            className="input"
            value={selectedBranchId}
            onChange={(e) => {
              const v = String(e.target.value || '').trim()
              try {
                if (v) localStorage.setItem('selectedBranchId_canteen', v)
                else localStorage.removeItem('selectedBranchId_canteen')
              } catch {}
              setSelectedBranchId(v)
              try { window.dispatchEvent(new CustomEvent('canteen_branch_changed', { detail: { branchId: v || null } })) } catch {}
              if (v) setBranchModalOpen(false)
            }}
          >
            <option value="">Şube seç</option>
            {allowedBranches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  )
}
