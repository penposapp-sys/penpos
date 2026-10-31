import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import SaleCategorySidebar from '../components/SaleCategorySidebar.jsx'
import SalesProductGrid from '../components/SalesProductGrid.jsx'
import ProductConfigModal from '../components/ProductConfigModal.jsx'
import Modal from '../components/Modal.jsx'
import { enqueueReceiptPrint } from '../lib/printingClient.js'
import { getProductPortionOptions, requiresProductConfig } from '../lib/productPortions.js'
import { inferPaymentMethodType, paymentMethodLabel } from '../lib/paymentMethods.js'
import { useCategorySwipe } from '../hooks/useCategorySwipe.js'
import { buildCartRows } from '../lib/cartItemRows.js'
import { ServingType } from '../utils/servingType.js'
import { useBusinessSettings } from '../context/BusinessSettingsContext.jsx'

const getId = (value) => String(value?._id || value?.id || '')
const money = (value) => Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const newRequestId = () => (
  globalThis.crypto?.randomUUID?.()
  || `quick-sale-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
)

export default function QuickSalePage() {
  const { user, allowedBranchIds } = useAuth()
  const { getSetting } = useBusinessSettings()
  const { isMobilePortrait } = useResponsiveFlags()
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentMode, setPaymentMode] = useState('payment')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountDraft, setDiscountDraft] = useState('0')
  const [discountOpen, setDiscountOpen] = useState(false)
  const [accountPickerOpen, setAccountPickerOpen] = useState(false)
  const [accountQuery, setAccountQuery] = useState('')
  const [accounts, setAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [selectedCreditAccount, setSelectedCreditAccount] = useState(null)
  const [createAccountOpen, setCreateAccountOpen] = useState(false)
  const [createAccountForm, setCreateAccountForm] = useState({ name: '', phone: '', note: '' })
  const [createAccountError, setCreateAccountError] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [cartViewMode, setCartViewMode] = useState('grouped')
  const [servingType, setServingType] = useState(ServingType.PLATE)
  const [sendToKitchen, setSendToKitchen] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [orderNote, setOrderNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [mobileCartExpanded, setMobileCartExpanded] = useState(false)
  const [configItem, setConfigItem] = useState(null)
  const requestIdRef = useRef('')
  const submitLockRef = useRef(false)

  const allowedIds = useMemo(
    () => new Set((Array.isArray(allowedBranchIds) ? allowedBranchIds : []).map(String).filter(Boolean)),
    [allowedBranchIds]
  )

  useEffect(() => {
    let active = true
    const loadBranches = async () => {
      setErrorText('')
      try {
        const response = await api('/api/branches', {
          skipBranchHeader: true,
          silent: true,
          suppressBranchModal: true
        })
        if (!response?.ok || response?.success === false) {
          throw new Error(response?.data?.message || response?.message || 'Şubeler yüklenemedi.')
        }
        const list = (Array.isArray(response?.branches) ? response.branches : []).filter((branch) => {
          const id = getId(branch)
          return id && branch.isActive !== false && (allowedIds.size === 0 || allowedIds.has(id))
        })
        if (!active) return
        setBranches(list)
        const storedId = (() => {
          try { return String(localStorage.getItem('selectedBranchId') || '').trim() } catch { return '' }
        })()
        const selectedId = list.some((branch) => getId(branch) === storedId)
          ? storedId
          : (list.length === 1 ? getId(list[0]) : '')
        setBranchId(selectedId)
        if (selectedId) {
          try { localStorage.setItem('selectedBranchId', selectedId) } catch {}
        }
        if (!selectedId) {
          setErrorText(list.length
            ? 'Satış için yetkili aktif şube seçin.'
            : 'Kullanılabilir yetkili aktif şube bulunamadı.')
        }
      } catch (err) {
        if (active) setErrorText(err?.data?.message || err?.message || 'Şubeler yüklenemedi.')
      }
    }
    void loadBranches()
    return () => { active = false }
  }, [allowedIds])

  useEffect(() => {
    const syncSelectedBranch = () => {
      let selectedId = ''
      try { selectedId = String(localStorage.getItem('selectedBranchId') || '').trim() } catch {}
      const isAvailable = branches.some((branch) => getId(branch) === selectedId)
      if (cart.length > 0 && selectedId !== branchId) {
        setErrorText('Sepet doluyken şube değiştirilemez. Mevcut satış seçili şubeye kaydedilir.')
        return
      }
      setBranchId(isAvailable ? selectedId : '')
      setErrorText(isAvailable ? '' : 'Satış için yetkili aktif şube seçin.')
    }
    window.addEventListener('selected_branch_changed', syncSelectedBranch)
    return () => window.removeEventListener('selected_branch_changed', syncSelectedBranch)
  }, [branches, branchId, cart.length])

  useEffect(() => {
    if (!branchId) {
      setCategories([])
      setProducts([])
      setPaymentMethods([])
      setPaymentMethod('')
      return
    }
    let active = true
    const loadCatalog = async () => {
      setLoading(true)
      setErrorText('')
      try {
        const [categoryResponse, productResponse, paymentResponse] = await Promise.all([
          api('/api/tenant/categories?active=true', { silent: true, branchIdOverride: branchId }),
          api('/api/tenant/menu-items?active=true', { silent: true, branchIdOverride: branchId }),
          api('/api/tenant/payment-settings', { silent: true, suppressBranchModal: true, branchIdOverride: branchId })
        ])
        if (!active) return
        if (categoryResponse?.success === false || productResponse?.success === false || paymentResponse?.success === false) {
          throw new Error(categoryResponse?.message || productResponse?.message || paymentResponse?.message || 'Satış verileri yüklenemedi.')
        }
        const nextCategories = Array.isArray(categoryResponse?.categories) ? categoryResponse.categories : []
        const nextProducts = Array.isArray(productResponse?.items) ? productResponse.items : []
        const methods = (Array.isArray(paymentResponse?.methods) ? paymentResponse.methods : [])
          .filter((method) => method?.isEnabled !== false && method?.enabled !== false)
          .filter((method) => inferPaymentMethodType(method) !== 'credit')
        setCategories(nextCategories)
        setProducts(nextProducts)
        setPaymentMethods(methods)
        setPaymentMethod((current) => (
          methods.some((method) => String(method.key || method.id || '') === current) ? current : ''
        ))
        setActiveCategory('')
      } catch (err) {
        if (active) setErrorText(err?.data?.message || err?.message || 'Satış verileri yüklenemedi.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadCatalog()
    return () => { active = false }
  }, [branchId])

  const visibleProducts = useMemo(() => {
    const categoryId = String(activeCategory || '')
    const query = String(search || '').trim().toLocaleLowerCase('tr-TR')
    return products.filter((product) => {
      const inCategory = !categoryId || String(product.categoryId || '') === categoryId
      const matchesSearch = !query || String(product.name || '').toLocaleLowerCase('tr-TR').includes(query)
      return inCategory && matchesSearch
    })
  }, [activeCategory, products, search])

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.price || 0) * (line.isWeightBased ? Number(line.weightGrams || 0) / 1000 : Number(line.quantity || 0)), 0),
    [cart]
  )
  const discountTotal = Math.round((total * discountPercent / 100 + Number.EPSILON) * 100) / 100
  const netTotal = Math.max(0, Math.round((total - discountTotal + Number.EPSILON) * 100) / 100)
  const cartCount = cart.reduce((sum, line) => sum + (line.isWeightBased ? 1 : Number(line.quantity || 0)), 0)
  const cartRows = useMemo(() => buildCartRows(
    cart.map((line) => ({
      ...line,
      _id: line.key,
      qty: line.isWeightBased ? 1 : line.quantity,
      subtotal: Number(line.price || 0) * (line.isWeightBased ? Number(line.weightGrams || 0) / 1000 : Number(line.quantity || 0)),
      status: 'open'
    })),
    cartViewMode,
    'quick-sale'
  ), [cart, cartViewMode])
  const cartLocked = Boolean(requestIdRef.current)
  const hasPerm = (permission) => ['tenant_admin', 'superadmin'].includes(String(user?.role || ''))
    || (user?.permissions || []).includes(permission)
  const canTakePayment = hasPerm('take_payment')
  const canCreateVeresiye = hasPerm('create_veresiye')
  const canViewAccounts = hasPerm('view_accounts')
  const canManageAccounts = hasPerm('manage_accounts') || hasPerm('accounts_manage')
  const creditAccountsDisabled = getSetting('general.disableCreditAccounts', false) === true

  const searchAccounts = async (query = accountQuery) => {
    if (!canViewAccounts) return
    setAccountsLoading(true)
    try {
      const response = await api(`/api/accounts?q=${encodeURIComponent(query || '')}&limit=20`)
      setAccounts(response.accounts || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAccountsLoading(false)
    }
  }

  const openAccountPicker = () => {
    if (!canCreateVeresiye || !canViewAccounts || creditAccountsDisabled) {
      toast.error(creditAccountsDisabled ? 'Cari hesap özelliği kapalı' : 'Veresiye için cari hesap görüntüleme ve veresiye yetkisi gerekir.')
      return
    }
    setPaymentMode('credit')
    setPaymentMethod('')
    setAccountQuery('')
    setAccounts([])
    setAccountPickerOpen(true)
  }

  useEffect(() => {
    if (!accountPickerOpen) return
    const timer = setTimeout(() => {
      void searchAccounts(accountQuery)
    }, 250)
    return () => clearTimeout(timer)
  }, [accountPickerOpen, accountQuery, allowedBranchIds])

  const submitQuickSaleAccount = async (event) => {
    event.preventDefault()
    if (!canManageAccounts || !branchId) {
      toast.error(!branchId ? 'Cari oluşturmak için etkin bir şube gerekli.' : 'Cari oluşturma yetkiniz yok.')
      return
    }
    const name = String(createAccountForm.name || '').trim()
    if (!name) {
      setCreateAccountError('Cari adı zorunludur.')
      return
    }
    setCreatingAccount(true)
    setCreateAccountError('')
    try {
      const response = await api('/api/accounts', {
        method: 'POST',
        data: {
          name,
          phone: String(createAccountForm.phone || '').trim(),
          note: String(createAccountForm.note || '').trim()
        },
        branchIdOverride: branchId,
        silent: true
      })
      if (!response?.ok || response?.success === false) {
        throw new Error(response?.data?.message || response?.message || 'Cari oluşturulamadı.')
      }
      const account = response?.account || response?.data?.account
      const id = getId(account)
      if (!id) throw new Error('Cari oluşturuldu ancak cari bilgisi alınamadı.')
      const createdAccount = { ...account, id }
      setAccounts((current) => [createdAccount, ...current.filter((item) => getId(item) !== id)])
      setSelectedCreditAccount(createdAccount)
      setPaymentMode('credit')
      setPaymentMethod('')
      setCreateAccountForm({ name: '', phone: '', note: '' })
      setCreateAccountOpen(false)
      setAccountPickerOpen(false)
      toast.success('Cari oluşturuldu ve seçildi.')
    } catch (err) {
      const message = err?.data?.message || err?.message || 'Cari oluşturulamadı.'
      setCreateAccountError(message)
      toast.error(message)
    } finally {
      setCreatingAccount(false)
    }
  }

  const addConfiguredProduct = useCallback((product, config = {}) => {
    if (cartLocked) return
    const portion = getProductPortionOptions(product).find((option) => option.key === config.portionKey) || getProductPortionOptions(product)[0]
    const weightGrams = product.isWeightBased ? Number(config.weightGrams) : null
    if (product.isWeightBased && (!Number.isInteger(weightGrams) || weightGrams < 1)) {
      toast.error('Gram bilgisi geçersiz.')
      return
    }
    const lineKey = [
      getId(product),
      portion.key,
      weightGrams || '',
      Math.random().toString(36).slice(2, 8)
    ].join(':')
    setCart((current) => {
      if (!product.isWeightBased) {
        const match = current.find((line) => (
          line.menuItemId === getId(product)
          && line.portionKey === portion.key
          && !line.isWeightBased
        ))
        if (match && cartViewMode === 'grouped') {
          return current.map((line) => line.key === match.key ? { ...line, quantity: line.quantity + 1 } : line)
        }
      }
      return [...current, {
        key: lineKey,
        menuItemId: getId(product),
        name: portion.label ? `${product.name} (${portion.label})` : product.name,
        imageUrl: product.imageUrl || '',
        price: Number(portion.price || 0),
        portionKey: portion.key,
        quantity: 1,
        isWeightBased: Boolean(product.isWeightBased),
        weightGrams,
        note: ''
      }]
    })
  }, [cartLocked, cartViewMode])

  const addProduct = useCallback((product) => {
    if (cartLocked) return
    if (requiresProductConfig(product)) {
      setConfigItem(product)
      return
    }
    addConfiguredProduct(product, { portionKey: 'full' })
  }, [addConfiguredProduct, cartLocked])

  const swipeHandlers = useCategorySwipe({
    categories,
    activeCategoryId: activeCategory,
    onSelect: setActiveCategory
  })

  const updateLine = (key, change) => {
    if (cartLocked) return
    setCart((current) => current.map((line) => line.key === key ? { ...line, ...change } : line))
  }
  const removeLine = (key) => {
    if (cartLocked) return
    setCart((current) => current.filter((line) => line.key !== key))
  }

  const confirmSale = async () => {
    if (!cart.length) return toast.error('Sepete ürün ekleyin.')
    if (paymentMode === 'credit' && !selectedCreditAccount) return toast.error('Veresiye için cari hesap seçin.')
    if (paymentMode === 'payment' && netTotal > 0 && !paymentMethod) return toast.error('Satışı onaylamadan önce ödeme türü seçin.')
    if (!branchId) return toast.error('Oturum için etkin bir şube bulunamadı.')
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    setErrorText('')
    if (!requestIdRef.current) requestIdRef.current = newRequestId()
    const requestId = requestIdRef.current
    try {
      const response = await api('/api/pos/quick-sales', {
        method: 'POST',
        data: {
          requestId,
          items: cart.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            portionKey: line.portionKey,
            weightGrams: line.weightGrams,
            note: line.note
          })),
          note: orderNote,
          paymentMethod: paymentMode === 'payment' ? paymentMethod : '',
          discountPercent,
          creditAccountId: paymentMode === 'credit' ? getId(selectedCreditAccount) : '',
          servingType,
          sendToKitchen
        },
        branchIdOverride: branchId,
        silent: true
      })
      if (!response?.ok || response?.success === false) {
        throw new Error(response?.data?.message || response?.message || 'Satış kaydedilemedi.')
      }
      const order = response?.order || response?.data?.order
      const orderId = getId(order)
      if (!orderId) throw new Error('Satış kaydedildi ancak satış numarası alınamadı.')

      requestIdRef.current = ''
      setCart([])
      setOrderNote('')
      setDiscountPercent(0)
      setDiscountDraft('0')
      setSelectedCreditAccount(null)
      setPaymentMode('payment')
      try {
        await enqueueReceiptPrint({
          system: 'kermes',
          orderId,
          copyCount: 1,
          idempotencyKey: `quick-sale-receipt:${orderId}`
        })
      } catch (printError) {
        toast.error(`Satış kaydedildi; fiş yazdırma kuyruğuna gönderilemedi: ${printError?.message || 'Yazıcı hatası'}`)
        return
      }
      if (response?.kitchenError || response?.data?.kitchenError) {
        toast.error(`Satış kaydedildi ve fiş kuyruğa alındı; mutfağa gönderim başarısız: ${response?.kitchenError || response?.data?.kitchenError}`)
      } else if (!sendToKitchen) {
        toast.success('Satış tamamlandı; fiş yazdırıldı. Mutfak gönderimi seçilmedi.')
      } else {
        toast.success('Satış tamamlandı; fiş ve mutfak siparişi gönderildi.')
      }
    } catch (err) {
      const message = err?.data?.message || err?.message || 'Satış tamamlanamadı.'
      setErrorText(`${message} Satış isteği güvenli biçimde korunmuştur; aynı sepetle tekrar deneyin.`)
      toast.error(message)
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="pageShell walkin-sales-page walkin-layout quick-sale-page">
        {errorText ? <div className="card" role="alert" style={{ color: 'var(--danger)', marginBottom: 10 }}>{errorText}</div> : null}
        <div className="walkin-sales-page__body">
          <div className="saleStandard3Col pos-grid quick-sale-grid">
            <SaleCategorySidebar
              categories={categories}
              activeCategoryId={activeCategory}
              showAllCategories
              onSelect={setActiveCategory}
            />
            <div className="card salePanel saleProductsPanel">
              <div className="saleProductsPanelHeader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <strong>Ürünler</strong>
                <input
                  className="input"
                  aria-label="Ürün ara"
                  placeholder="Ürün ara…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  style={{ maxWidth: 240 }}
                />
              </div>
              {loading ? <div className="salePanelScroll">Yükleniyor…</div> : (
                <div className="salePanelScroll saleProductSwipeSurface" {...swipeHandlers}>
                  <div className="posItemsGrid">
                    <SalesProductGrid
                      visibleItems={visibleProducts}
                      onItemClick={addProduct}
                      isMobilePortrait={isMobilePortrait}
                      showProductImages
                    />
                  </div>
                  {!visibleProducts.length ? <div className="muted" style={{ padding: 18 }}>Ürün bulunamadı.</div> : null}
                </div>
              )}
            </div>
            <section className="card salePanel saleCartPanelShell walkin-cart-panel quick-sale-cart-panel" data-mobile-expanded={mobileCartExpanded}>
              <button
                type="button"
                className="saleCartMobileToggle"
                aria-expanded={mobileCartExpanded}
                onClick={() => setMobileCartExpanded((value) => !value)}
              >
                <span>Sepet · {cartCount} ürün</span>
                <span>{money(netTotal)} TL · {mobileCartExpanded ? 'Kapat' : 'Aç'}</span>
              </button>
              <div className="saleCartPanelContent">
                <header className="saleCartHeader"><strong>Sepet</strong><span>{cartCount} ürün</span></header>
                <div className="saleCartModeRow quick-sale-cart-options">
                  <div className="saleCartModeRowInner">
                    <div className="saleCartModeGroup saleCartModeGroup--compact">
                      <button type="button" className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setCartViewMode('grouped')} disabled={cartLocked} aria-pressed={cartViewMode === 'grouped'}>Toplu</button>
                      <button type="button" className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setCartViewMode('separate')} disabled={cartLocked} aria-pressed={cartViewMode === 'separate'}>Ayrı</button>
                    </div>
                    <div className="saleCartModeDivider" aria-hidden="true" />
                    <div className="saleCartModeGroup saleCartModeGroup--service">
                      <button type="button" className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setServingType(ServingType.TRAY)} disabled={cartLocked} aria-pressed={servingType === ServingType.TRAY}>TEPSİ</button>
                      <button type="button" className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setServingType(ServingType.PLATE)} disabled={cartLocked} aria-pressed={servingType === ServingType.PLATE}>TABAK</button>
                      <button type="button" className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setServingType(ServingType.PACKAGE)} disabled={cartLocked} aria-pressed={servingType === ServingType.PACKAGE}>PAKET</button>
                    </div>
                  </div>
                  <div className="quick-sale-kitchen-mode">
                    <span>Mutfağa Düşsün</span>
                    <div className="saleCartModeGroup">
                      <button type="button" className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setSendToKitchen(true)} disabled={cartLocked} aria-pressed={sendToKitchen}>Mutfağa Düşsün</button>
                      <button type="button" className="btn btn--xs btn--toggle saleCartModeBtn" onClick={() => setSendToKitchen(false)} disabled={cartLocked} aria-pressed={!sendToKitchen}>Düşmesin</button>
                    </div>
                  </div>
                </div>
                <div className="saleCartList">
                  {cartRows.map((row) => {
                    const line = row.repr
                    const quantity = Number(row.qty || 0)
                    return (
                    <div className="sale-cart-line" key={row.key}>
                      <div className="sale-cart-line__info">
                        <div className="quick-sale-cart-product-heading">
                          <strong>{line.name}</strong>
                        </div>
                        <input
                          className="input quick-sale-cart-product-note"
                          aria-label={`${line.name} ürün notu`}
                          placeholder="Ürün notu ekle"
                          value={line.note}
                          onChange={(event) => updateLine(line.key, { note: event.target.value })}
                          disabled={cartLocked}
                        />
                      </div>
                      <div className="sale-cart-line__detail">
                        {line.isWeightBased
                          ? `${line.weightGrams} gr × ${money(line.price)} TL/kg`
                          : `${money(line.price)} TL × ${quantity}`}
                      </div>
                      <div className="sale-cart-line__actions">
                        {!line.isWeightBased ? (
                          <>
                            <button type="button" className="btn btn--xs" aria-label="Adedi azalt" disabled={cartLocked} onClick={() => line.quantity <= 1 ? removeLine(line.key) : updateLine(line.key, { quantity: line.quantity - 1 })}>−</button>
                            <span>{quantity}</span>
                            <button type="button" className="btn btn--xs" aria-label="Adedi artır" disabled={cartLocked} onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}>+</button>
                          </>
                        ) : <span>{line.weightGrams} gr</span>}
                        <button
                          type="button"
                          className="btn btn--xs btn--danger"
                          aria-label="Ürünü kaldır"
                          disabled={cartLocked}
                          onClick={() => cartViewMode === 'separate' && !line.isWeightBased && line.quantity > 1
                            ? updateLine(line.key, { quantity: line.quantity - 1 })
                            : removeLine(line.key)}
                        >
                          Sil
                        </button>
                      </div>
                      <strong className="sale-cart-line__price">
                        {money(Number(row.subtotal || 0))} TL
                      </strong>
                    </div>
                  )})}
                  {!cart.length ? <div className="muted" style={{ padding: 18 }}>Satış için ürün seçin.</div> : null}
                </div>
                <footer className="saleCartFooter">
                  <div className="saleCartFooterInner">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <strong>Toplam: {money(netTotal)} TL</strong>
                      <button
                        type="button"
                        className={discountPercent > 0 ? 'btn btn--primary' : 'btn'}
                        disabled={cartLocked || !cart.length}
                        onClick={() => {
                          setDiscountDraft(String(discountPercent))
                          setDiscountOpen(true)
                        }}
                      >
                        İndirim{discountPercent > 0 ? ` · %${money(discountPercent)}` : ''}
                      </button>
                    </div>
                    {discountPercent > 0 ? (
                      <div className="muted" style={{ fontSize: 13 }}>
                        Ara toplam: {money(total)} TL · İndirim: -{money(discountTotal)} TL
                      </div>
                    ) : null}
                    <div style={{ display: 'grid', gap: 8 }}>
                      <strong>Ödeme türü</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {paymentMethods.map((method) => {
                          const key = String(method.key || method.id || '')
                          const selected = paymentMode === 'payment' && paymentMethod === key
                          return (
                            <button
                              type="button"
                              key={key}
                              className={selected ? 'btn btn--primary' : 'btn'}
                              aria-pressed={selected}
                              disabled={cartLocked}
                              onClick={() => {
                                setPaymentMode('payment')
                                setPaymentMethod(key)
                                setSelectedCreditAccount(null)
                              }}
                            >
                              {paymentMethodLabel(method)}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          className={paymentMode === 'credit' ? 'btn btn--primary' : 'btn'}
                          aria-pressed={paymentMode === 'credit'}
                          disabled={cartLocked || !canCreateVeresiye || !canViewAccounts || creditAccountsDisabled}
                          onClick={openAccountPicker}
                        >
                          Veresiye
                        </button>
                        {!paymentMethods.length ? <span className="muted">Kullanılabilir ödeme türü yok.</span> : null}
                      </div>
                      {paymentMode === 'credit' && selectedCreditAccount ? (
                        <span className="muted">Cari: {selectedCreditAccount.name}</span>
                      ) : null}
                      {creditAccountsDisabled ? <span className="muted">Cari hesap özelliği kapalı.</span> : null}
                      {!canCreateVeresiye || !canViewAccounts ? <span className="muted">Veresiye için cari görüntüleme ve veresiye yetkisi gerekir.</span> : null}
                    </div>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <strong>Sipariş notu</strong>
                      <textarea className="input" rows={2} maxLength={1000} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} disabled={cartLocked} />
                    </label>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={submitting || !cart.length || !branchId || !canTakePayment
                        || (netTotal > 0 && paymentMode === 'payment' && !paymentMethod)
                        || (paymentMode === 'credit' && !selectedCreditAccount)}
                      onClick={confirmSale}
                    >
                      {submitting ? 'Kaydediliyor…' : 'Onayla'}
                    </button>
                    {!canTakePayment ? <span className="muted">Satış tahsilatı için yetkiniz bulunmuyor.</span> : null}
                  </div>
                </footer>
              </div>
            </section>
          </div>
        </div>
        <Modal
          open={discountOpen}
          title="Satış İndirimi"
          onClose={() => setDiscountOpen(false)}
          dialogStyle={{ width: 'min(460px, calc(100vw - 24px))' }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <strong>İndirim oranı (%)</strong>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountDraft}
                onChange={(event) => setDiscountDraft(event.target.value)}
                disabled={cartLocked}
              />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Hazır indirim oranları">
              {[0, 5, 10, 15, 20, 25, 30, 50, 75, 100].map((rate) => (
                <button
                  type="button"
                  key={rate}
                  className={Number(discountDraft) === rate ? 'btn btn--primary' : 'btn'}
                  aria-pressed={Number(discountDraft) === rate}
                  disabled={cartLocked}
                  onClick={() => setDiscountDraft(String(rate))}
                >
                  %{rate}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setDiscountOpen(false)}>Vazgeç</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={cartLocked}
                onClick={() => {
                  const value = Number(discountDraft)
                  if (!Number.isFinite(value) || value < 0 || value > 100) {
                    toast.error('İndirim oranı 0 ile 100 arasında olmalı.')
                    return
                  }
                  setDiscountPercent(value)
                  setDiscountOpen(false)
                }}
              >
                İndirimi Uygula
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          open={accountPickerOpen}
          title="Veresiye Cari Hesabı"
          onClose={() => setAccountPickerOpen(false)}
          dialogStyle={{ width: 'min(560px, calc(100vw - 24px))' }}
        >
          <form
            style={{ display: 'grid', gap: 12 }}
            onSubmit={(event) => {
              event.preventDefault()
              void searchAccounts(accountQuery)
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={accountQuery}
                onChange={(event) => setAccountQuery(event.target.value)}
                placeholder="Cari adı veya telefon"
                aria-label="Cari hesap ara"
              />
              <button type="submit" className="btn" disabled={accountsLoading}>Ara</button>
              {canManageAccounts ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setCreateAccountError('')
                    setCreateAccountForm({ name: '', phone: '', note: '' })
                    setAccountPickerOpen(false)
                    setCreateAccountOpen(true)
                  }}
                  disabled={accountsLoading}
                >
                  + Yeni Cari
                </button>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 8, maxHeight: '50vh', overflowY: 'auto' }}>
              {accounts.map((account) => (
                <button
                  type="button"
                  key={getId(account)}
                  className="btn"
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}
                  onClick={() => {
                    setSelectedCreditAccount(account)
                    setPaymentMode('credit')
                    setPaymentMethod('')
                    setAccountPickerOpen(false)
                  }}
                >
                  <span>
                    <strong>{account.name}</strong>
                    {account.phone ? <span className="muted" style={{ display: 'block' }}>{account.phone}</span> : null}
                  </span>
                  <span className="muted">Bakiye: {money(account.balance)} TL</span>
                </button>
              ))}
              {!accountsLoading && accounts.length === 0 ? <span className="muted">Cari hesap bulunamadı.</span> : null}
              {accountsLoading ? <span className="muted">Cari hesaplar yükleniyor…</span> : null}
            </div>
          </form>
        </Modal>
        <Modal
          open={createAccountOpen}
          title="Yeni Cari"
          onClose={() => {
            if (creatingAccount) return
            setCreateAccountOpen(false)
            setCreateAccountError('')
          }}
          dialogStyle={{ width: 'min(520px, calc(100vw - 24px))' }}
        >
          <form onSubmit={submitQuickSaleAccount} style={{ display: 'grid', gap: 12 }}>
            {createAccountError ? (
              <div className="card" role="alert" style={{ color: 'var(--danger)' }}>{createAccountError}</div>
            ) : null}
            <label style={{ display: 'grid', gap: 6 }}>
              <strong>Ad Soyad (zorunlu)</strong>
              <input
                className="input"
                value={createAccountForm.name}
                onChange={(event) => setCreateAccountForm((current) => ({ ...current, name: event.target.value }))}
                disabled={creatingAccount}
                autoFocus
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <strong>Telefon</strong>
              <input
                className="input"
                value={createAccountForm.phone}
                onChange={(event) => setCreateAccountForm((current) => ({ ...current, phone: event.target.value }))}
                disabled={creatingAccount}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <strong>Not</strong>
              <input
                className="input"
                value={createAccountForm.note}
                onChange={(event) => setCreateAccountForm((current) => ({ ...current, note: event.target.value }))}
                disabled={creatingAccount}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setCreateAccountOpen(false)}
                disabled={creatingAccount}
              >
                Vazgeç
              </button>
              <button type="submit" className="btn btn--primary" disabled={creatingAccount || !branchId}>
                {creatingAccount ? 'Kaydediliyor…' : 'Cari Oluştur'}
              </button>
            </div>
          </form>
        </Modal>
        <ProductConfigModal
          open={Boolean(configItem)}
          item={configItem}
          onClose={() => setConfigItem(null)}
          onSubmit={(payload) => {
            addConfiguredProduct(configItem, payload)
            return true
          }}
        />
    </div>
  )
}
