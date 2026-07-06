import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import ProductImage from '../components/ProductImage.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

const CUSTOMER_FORM = { name: '', phone: '', location: '', address: '', note: '' }
const LOGIN_FORM = { phone: '', password: '' }
const REGISTER_FORM = { name: '', phone: '', password: '', passwordRepeat: '', location: '', address: '' }
const PROFILE_FORM = { name: '', phone: '', location: '', address: '' }
const CART_CONFIG_FORM = { grams: '', portionKey: 'full' }
const ONLINE_PAYMENT_OPTIONS = [
  { key: 'cash', label: 'Nakit' },
  { key: 'card', label: 'Kart' },
  { key: 'bank', label: 'Havale' }
]

const money = (value) => `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR')
const normalizePhone = (value) => String(value || '').trim().replace(/\s+/g, '').replace(/[^0-9+]/g, '')
const buildSessionKey = (tenantId, branchId) => `public-online-customer:${tenantId || 'tenant'}:${branchId || 'branch'}`
const buildCartKey = (tenantId, branchId) => `public-online-cart:${tenantId || 'tenant'}:${branchId || 'branch'}`

const getOnlineOrderStatusLabel = (order) => {
  const status = String(order?.status || '').trim()
  const deliveryStatus = String(order?.deliveryStatus || '').trim()
  const approvalStatus = String(order?.approvalStatus || '').trim()
  const cancelRequestStatus = String(order?.cancelRequestStatus || '').trim()

  if (cancelRequestStatus === 'pending') return 'Iptal Talebi Bekliyor'
  if (status === 'cancelled' || ['cancelled', 'iptal_edildi', 'geri_dondu', 'musteriyi_bulamadi', 'adreste_yok'].includes(deliveryStatus)) return 'Iptal Edildi'
  if (cancelRequestStatus === 'approved') return 'Iptal Edildi'
  if (approvalStatus === 'pending') return 'Onay Bekliyor'
  if (approvalStatus === 'rejected') return 'Reddedildi'
  if (deliveryStatus === 'teslim_edildi' || deliveryStatus === 'delivered') return 'Teslim Edildi'
  if (deliveryStatus === 'yola_cikti') return 'Yolda'
  if (deliveryStatus === 'hazir' || deliveryStatus === 'ready' || deliveryStatus === 'completed') return 'Hazir'
  if (deliveryStatus === 'kuryeye_atandi') return 'Kurye Atandi'
  if (deliveryStatus === 'hazirlaniyor' || deliveryStatus === 'preparing' || deliveryStatus === 'accepted' || deliveryStatus === 'cooking') return 'Hazirlaniyor'
  if (deliveryStatus === 'yeni' || deliveryStatus === 'pending') return 'Yeni Siparis'
  if (approvalStatus === 'approved') return 'Onaylandi'
  return 'Onaylandi'
}

const getOnlineItemStatusLabel = (item, order = null) => {
  const itemStatus = String(item?.status || '').trim()
  if (item?.statusLabel) return String(item.statusLabel)
  if (itemStatus === 'cancelled') return 'Iptal'
  if (itemStatus === 'completed') return 'Hazir'
  if (itemStatus === 'cooking' || itemStatus === 'sent') return 'Hazirlaniyor'
  if (String(order?.approvalStatus || '').trim() === 'pending') return 'Onay Bekliyor'
  return 'Bekliyor'
}

const getOnlineItemStatusStyle = (item, order = null) => {
  const label = getOnlineItemStatusLabel(item, order)
  if (label === 'Iptal') return { bg: '#fee2e2', color: '#b91c1c' }
  if (label === 'Hazir') return { bg: '#dcfce7', color: '#166534' }
  if (label === 'Hazirlaniyor') return { bg: '#dbeafe', color: '#1d4ed8' }
  if (label === 'Onay Bekliyor') return { bg: '#fef3c7', color: '#b45309' }
  return { bg: '#e5e7eb', color: '#374151' }
}

const createCartLineKey = () => `cart:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
const toSafeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}
const getPortionOptions = (item) => {
  const basePrice = toSafeNumber(item?.price)
  const options = [{ key: 'full', label: 'Tam Porsiyon', price: basePrice }]
  if (item?.halfPortionEnabled) options.push({ key: 'half', label: 'Yarim Porsiyon', price: toSafeNumber(item?.halfPortionPrice, basePrice) })
  if (item?.oneAndHalfPortionEnabled) options.push({ key: 'one_and_half', label: 'Bir Bucuk Porsiyon', price: toSafeNumber(item?.oneAndHalfPortionPrice, basePrice) })
  return options
}
const getSelectedPortion = (item, portionKey) => getPortionOptions(item).find((option) => option.key === portionKey) || getPortionOptions(item)[0]
const mapCartRows = (cartLines, items) => (Array.isArray(cartLines) ? cartLines : [])
  .map((line) => {
    const item = (items || []).find((entry) => String(entry?.id || '') === String(line?.menuItemId || ''))
    if (!item) return null
    const portion = getSelectedPortion(item, line?.portionKey || 'full')
    const quantity = Math.max(1, Number(line?.quantity || 1))
    const weightGrams = line?.weightGrams === undefined || line?.weightGrams === null || line?.weightGrams === ''
      ? null
      : Math.max(1, Math.round(Number(line.weightGrams)))
    const unitPrice = toSafeNumber(portion?.price, toSafeNumber(item?.price))
    const totalPrice = weightGrams ? (unitPrice * weightGrams) / 1000 : unitPrice * quantity
    return {
      key: String(line?.key || createCartLineKey()),
      item,
      quantity,
      note: String(line?.note || ''),
      weightGrams,
      portionKey: portion?.key || 'full',
      portionLabel: portion?.key === 'full' ? '' : String(portion?.label || ''),
      unitPrice,
      totalPrice,
      displayName: portion?.key === 'full' ? String(item?.name || '') : `${String(item?.name || '')} (${String(portion?.label || '')})`
    }
  })
  .filter(Boolean)

export default function OnlineSalesPage() {
  const { tenantSlug } = useParams()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState('home')
  const [accountMode, setAccountMode] = useState('login')
  const [menuOpen, setMenuOpen] = useState(false)
  const [tenant, setTenant] = useState(null)
  const [branch, setBranch] = useState(null)
  const [contact, setContact] = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState('all')
  const [cartLines, setCartLines] = useState([])
  const [customerForm, setCustomerForm] = useState(CUSTOMER_FORM)
  const [loginForm, setLoginForm] = useState(LOGIN_FORM)
  const [registerForm, setRegisterForm] = useState(REGISTER_FORM)
  const [profileForm, setProfileForm] = useState(PROFILE_FORM)
  const [customerSession, setCustomerSession] = useState(null)
  const [customerProfile, setCustomerProfile] = useState(null)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [successOrder, setSuccessOrder] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [configProduct, setConfigProduct] = useState(null)
  const [cartConfig, setCartConfig] = useState(CART_CONFIG_FORM)
  const [editingNoteKey, setEditingNoteKey] = useState('')
  const [itemNoteDraft, setItemNoteDraft] = useState('')
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash')

  useBodyLayoutMode('public-site-layout')

  const requestedBranchId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return String(params.get('branchId') || '').trim()
  }, [location.search])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const query = new URLSearchParams({ tenantSlug: String(tenantSlug || '').trim() })
        if (requestedBranchId) query.set('branchId', requestedBranchId)
        const res = await api(`/api/public/online-store?${query.toString()}`, {
          silent: true,
          skipBranchHeader: true
        })
        if (!mounted) return
        if (res?.success === false) throw new Error(res?.message || 'Sayfa acilamadi')
        setTenant(res?.tenant || null)
        setBranch(res?.branch || null)
        setContact(res?.contact || null)
        setCategories(Array.isArray(res?.categories) ? res.categories : [])
        setItems(Array.isArray(res?.items) ? res.items : [])
      } catch (err) {
        if (mounted) setError(err?.message || 'Sayfa acilamadi')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [requestedBranchId, tenantSlug])

  const tenantId = String(tenant?.id || '')
  const branchId = String(branch?.id || tenant?.settings?.onlineSales?.branchId || '')
  const sessionStorageKey = buildSessionKey(tenantId, branchId)
  const cartStorageKey = buildCartKey(tenantId, branchId)
  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 980 : false
  const brandName = String(tenant?.name || tenant?.settings?.onlineSales?.title || 'Restoran').trim() || 'Restoran'

  useEffect(() => {
    if (!tenantId || !branchId) return
    try {
      const raw = localStorage.getItem(sessionStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.customerId || parsed?.id) {
        setCustomerSession({
          customerId: String(parsed.customerId || parsed.id || ''),
          name: String(parsed.name || ''),
          phone: String(parsed.phone || ''),
          location: String(parsed.location || ''),
          address: String(parsed.address || '')
        })
      }
    } catch {}
  }, [tenantId, branchId, sessionStorageKey])

  useEffect(() => {
    if (!tenantId || !branchId || !customerSession?.customerId) return
    try {
      localStorage.setItem(sessionStorageKey, JSON.stringify(customerSession))
    } catch {}
  }, [branchId, customerSession, sessionStorageKey, tenantId])

  useEffect(() => {
    if (!tenantId || !branchId) return
    try {
      const raw = localStorage.getItem(cartStorageKey)
      if (!raw) {
        setCartLines([])
        return
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setCartLines([])
        return
      }
      setCartLines(parsed
        .filter((line) => line && line.menuItemId)
        .map((line) => ({
          key: String(line.key || createCartLineKey()),
          menuItemId: String(line.menuItemId),
          quantity: Math.max(1, Number(line.quantity || 1)),
          note: String(line.note || ''),
          weightGrams: line.weightGrams === undefined || line.weightGrams === null || line.weightGrams === ''
            ? null
            : Math.max(1, Math.round(Number(line.weightGrams))),
          portionKey: String(line.portionKey || 'full')
        })))
    } catch {
      setCartLines([])
    }
  }, [branchId, cartStorageKey, tenantId])

  useEffect(() => {
    if (!tenantId || !branchId) return
    try {
      if (cartLines.length === 0) {
        localStorage.removeItem(cartStorageKey)
        return
      }
      localStorage.setItem(cartStorageKey, JSON.stringify(cartLines))
    } catch {}
  }, [branchId, cartLines, cartStorageKey, tenantId])

  useEffect(() => {
    document.title = tenant?.name ? `${tenant.name} | Online Siparis` : 'PenPOS | Online Siparis'
  }, [tenant?.name])

  const cartRows = useMemo(() => mapCartRows(cartLines, items), [cartLines, items])
  const cartCount = useMemo(() => cartRows.reduce((sum, row) => sum + row.quantity, 0), [cartRows])
  const cartTotal = useMemo(() => cartRows.reduce((sum, row) => sum + row.totalPrice, 0), [cartRows])
  const categoryOrderMap = useMemo(() => {
    const entries = (categories || []).map((category, index) => [String(category?.id || ''), index])
    return new Map(entries)
  }, [categories])
  const filteredItems = useMemo(() => {
    const query = normalizeText(search)
    return (items || []).filter((item) => {
      if (activeCategoryId !== 'all' && String(item?.categoryId || '') !== String(activeCategoryId)) return false
      if (!query) return true
      return normalizeText(`${item?.name || ''} ${item?.description || ''}`).includes(query)
    }).sort((left, right) => {
      const leftCategoryOrder = categoryOrderMap.get(String(left?.categoryId || '')) ?? Number.MAX_SAFE_INTEGER
      const rightCategoryOrder = categoryOrderMap.get(String(right?.categoryId || '')) ?? Number.MAX_SAFE_INTEGER
      if (leftCategoryOrder !== rightCategoryOrder) return leftCategoryOrder - rightCategoryOrder
      return String(left?.name || '').localeCompare(String(right?.name || ''), 'tr')
    })
  }, [activeCategoryId, categoryOrderMap, items, search])
  const groupedFilteredItems = useMemo(() => {
    if (activeCategoryId !== 'all') return []
    const groups = []
    const groupMap = new Map()
    filteredItems.forEach((item) => {
      const categoryId = String(item?.categoryId || '')
      const category = (categories || []).find((entry) => String(entry?.id || '') === categoryId)
      const categoryName = String(item?.categoryName || category?.name || 'Diger Urunler')
      if (!groupMap.has(categoryId)) {
        const nextGroup = { categoryId, categoryName, items: [] }
        groupMap.set(categoryId, nextGroup)
        groups.push(nextGroup)
      }
      groupMap.get(categoryId)?.items.push(item)
    })
    return groups
  }, [activeCategoryId, categories, filteredItems])
  const activeCategoryName = activeCategoryId === 'all'
    ? 'Tum Urunler'
    : (categories.find((category) => String(category?.id || '') === String(activeCategoryId))?.name || 'Kategori')

  const loadCustomerProfile = async (session = customerSession) => {
    const customerId = String(session?.customerId || '')
    if (!tenantId || !branchId || !customerId) return
    const res = await api(`/api/public/online-store/customer/profile?tenantId=${encodeURIComponent(tenantId)}&branchId=${encodeURIComponent(branchId)}&customerId=${encodeURIComponent(customerId)}`, {
      silent: true,
      skipBranchHeader: true
    })
    if (res?.success === false) {
      toast.error(res?.message || 'Musteri bilgileri yuklenemedi')
      return
    }
    const customer = res?.customer || {}
    setCustomerProfile(res || null)
    setCustomerSession({
      customerId: String(customer?.id || customerId),
      name: String(customer?.name || ''),
      phone: String(customer?.phone || ''),
      location: String(customer?.location || ''),
      address: String(customer?.address || '')
    })
    setProfileForm({
      name: String(customer?.name || ''),
      phone: String(customer?.phone || ''),
      location: String(customer?.location || ''),
      address: String(customer?.address || '')
    })
  }

  useEffect(() => {
    if (!customerSession?.customerId) return
    loadCustomerProfile(customerSession)
  }, [branchId, customerSession?.customerId, tenantId])

  const upsertCartLine = (line) => {
    if (!line?.menuItemId) return
    setCartLines((current) => {
      const normalizedLine = {
        key: String(line.key || createCartLineKey()),
        menuItemId: String(line.menuItemId),
        quantity: Math.max(1, Number(line.quantity || 1)),
        note: String(line.note || ''),
        weightGrams: line.weightGrams === undefined || line.weightGrams === null || line.weightGrams === ''
          ? null
          : Math.max(1, Math.round(Number(line.weightGrams))),
        portionKey: String(line.portionKey || 'full')
      }
      const mergeIndex = current.findIndex((entry) =>
        String(entry.menuItemId) === normalizedLine.menuItemId &&
        String(entry.portionKey || 'full') === normalizedLine.portionKey &&
        String(entry.note || '') === normalizedLine.note &&
        String(entry.weightGrams || '') === String(normalizedLine.weightGrams || '')
      )
      if (mergeIndex >= 0 && normalizedLine.weightGrams == null) {
        return current.map((entry, index) => index === mergeIndex
          ? { ...entry, quantity: Math.max(1, Number(entry.quantity || 1) + normalizedLine.quantity) }
          : entry)
      }
      return [...current, normalizedLine]
    })
  }

  const updateCartLineQty = (lineKey, nextQty) => {
    setCartLines((current) => current.flatMap((line) => {
      if (String(line?.key || '') !== String(lineKey || '')) return [line]
      const safeQty = Math.max(0, Number(nextQty || 0))
      if (safeQty <= 0) return []
      return [{ ...line, quantity: safeQty }]
    }))
  }

  const updateCartLineNote = (lineKey, note) => {
    setCartLines((current) => current.map((line) => (
      String(line?.key || '') === String(lineKey || '')
        ? { ...line, note: String(note || '') }
        : line
    )))
  }

  const addToCart = (item) => {
    if (!item?.id) return
    const hasPortionChoice = getPortionOptions(item).length > 1
    setSelectedProduct(null)
    if (item?.isWeightBased || hasPortionChoice) {
      setConfigProduct(item)
      setCartConfig({ grams: '', portionKey: 'full' })
      return
    }
    upsertCartLine({ menuItemId: item.id, quantity: 1, note: '', weightGrams: null, portionKey: 'full' })
    toast.success(`${item.name} sepete eklendi`)
  }

  const submitCartConfig = () => {
    if (!configProduct?.id) return
    const hasPortionChoice = getPortionOptions(configProduct).length > 1
    const grams = String(cartConfig.grams || '').replace(',', '.').trim()
    const weightGrams = configProduct?.isWeightBased ? Math.round(Number(grams)) : null
    if (configProduct?.isWeightBased && (!Number.isFinite(weightGrams) || weightGrams <= 0)) {
      toast.error('Gramaj bilgisi gerekli')
      return
    }
    upsertCartLine({
      menuItemId: configProduct.id,
      quantity: 1,
      note: '',
      weightGrams,
      portionKey: hasPortionChoice ? String(cartConfig.portionKey || 'full') : 'full'
    })
    toast.success(`${configProduct.name} sepete eklendi`)
    setConfigProduct(null)
    setCartConfig(CART_CONFIG_FORM)
  }

  const repeatOnlineOrder = (order) => {
    const orderItems = Array.isArray(order?.items) ? order.items : []
    if (orderItems.length === 0) {
      toast.error('Tekrarlanacak urun bulunamadi')
      return
    }
    orderItems.forEach((entry) => {
      const matchedItem = (items || []).find((item) =>
        String(item?.id || '') === String(entry?.menuItemId || '')
        || String(item?.name || '').trim() === String(entry?.name || '').trim()
      )
      if (!matchedItem?.id) return
      upsertCartLine({
        menuItemId: matchedItem.id,
        quantity: Math.max(1, Number(entry?.quantity || 1)),
        note: String(entry?.note || ''),
        weightGrams: Number(entry?.weightGrams || 0) > 0 ? Number(entry.weightGrams) : null,
        portionKey: 'full'
      })
    })
    setSelectedHistoryOrder(null)
    setView('cart')
    toast.success('Siparis sepete tekrar eklendi')
  }

  const requestOrderCancellation = async (order) => {
    if (!customerSession?.customerId) {
      toast.error('Iptal talebi icin giris yapilmali')
      return
    }
    try {
      const res = await api(`/api/public/online-store/orders/${encodeURIComponent(String(order?.id || ''))}/cancel-request`, {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          branchId,
          customerId: customerSession.customerId
        }),
        silent: true,
        skipBranchHeader: true
      })
      if (res?.success === false) throw new Error(res?.message || 'Iptal talebi olusturulamadi')
      await loadCustomerProfile(customerSession)
      setSelectedHistoryOrder((current) => current && String(current.id || '') === String(order?.id || '')
        ? { ...current, cancelRequestStatus: 'pending' }
        : current)
      toast.success('Iptal talebi gonderildi')
    } catch (err) {
      toast.error(err?.message || 'Iptal talebi olusturulamadi')
    }
  }

  const openHome = () => {
    setView('home')
    setMenuOpen(false)
  }

  const openProductDetail = (item) => {
    if (!item?.id) return
    setSelectedProduct(item)
  }

  const logoutAccount = () => {
    setCustomerSession(null)
    setCustomerProfile(null)
    setProfileEditing(false)
    try { localStorage.removeItem(sessionStorageKey) } catch {}
    toast.success('Musteri oturumu kapatildi')
  }

  const submitLogin = async () => {
    if (!tenantId || !branchId) return
    const phone = normalizePhone(loginForm.phone)
    const password = String(loginForm.password || '')
    if (!phone || !password) {
      toast.error('Telefon ve sifre zorunlu')
      return
    }
    const res = await api('/api/public/online-store/customer/login', {
      method: 'POST',
      body: JSON.stringify({ tenantId, branchId, phone, password }),
      silent: true,
      skipBranchHeader: true
    })
    if (res?.success === false) {
      toast.error(res?.message || 'Giris yapilamadi')
      return
    }
    const customer = res?.customer || {}
    setCustomerSession({
      customerId: String(customer?.id || ''),
      name: String(customer?.name || ''),
      phone: String(customer?.phone || ''),
      location: String(customer?.location || ''),
      address: String(customer?.address || '')
    })
    setLoginForm(LOGIN_FORM)
    setView('account')
    toast.success('Hesabiniza giris yapildi')
  }

  const submitRegister = async () => {
    if (!tenantId || !branchId) return
    if (!registerForm.name.trim() || !normalizePhone(registerForm.phone) || !registerForm.password || !registerForm.passwordRepeat) {
      toast.error('Ad soyad, telefon, sifre ve sifre tekrar zorunlu')
      return
    }
    if (registerForm.password !== registerForm.passwordRepeat) {
      toast.error('Sifreler ayni degil')
      return
    }
    const res = await api('/api/public/online-store/customer/register', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        branchId,
        name: registerForm.name,
        phone: normalizePhone(registerForm.phone),
        password: registerForm.password,
        passwordRepeat: registerForm.passwordRepeat,
        location: registerForm.location,
        address: registerForm.address
      }),
      silent: true,
      skipBranchHeader: true
    })
    if (res?.success === false) {
      toast.error(res?.message || 'Hesap olusturulamadi')
      return
    }
    const customer = res?.customer || {}
    setCustomerSession({
      customerId: String(customer?.id || ''),
      name: String(customer?.name || ''),
      phone: String(customer?.phone || ''),
      location: String(customer?.location || ''),
      address: String(customer?.address || '')
    })
    setRegisterForm(REGISTER_FORM)
    setAccountMode('login')
    setView('account')
    toast.success('Hesap acildi')
  }

  const submitProfileUpdate = async () => {
    if (!tenantId || !branchId || !customerSession?.customerId) return
    setProfileSaving(true)
    try {
      const res = await api('/api/public/online-store/customer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          tenantId,
          branchId,
          customerId: customerSession.customerId,
          name: profileForm.name,
          phone: normalizePhone(profileForm.phone),
          location: profileForm.location,
          address: profileForm.address
        }),
        silent: true,
        skipBranchHeader: true
      })
      if (res?.success === false) {
        toast.error(res?.message || 'Bilgiler guncellenemedi')
        return
      }
      const customer = res?.customer || {}
      setCustomerSession({
        customerId: String(customer?.id || customerSession.customerId),
        name: String(customer?.name || ''),
        phone: String(customer?.phone || ''),
        location: String(customer?.location || ''),
        address: String(customer?.address || '')
      })
      setProfileEditing(false)
      await loadCustomerProfile({ customerId: String(customer?.id || customerSession.customerId) })
      toast.success('Hesap bilgileri guncellendi')
    } finally {
      setProfileSaving(false)
    }
  }

  const submitOrder = async () => {
    if (cartRows.length === 0) {
      toast.error('Sepet bos')
      return
    }

    const effectiveCustomer = customerSession?.customerId
      ? {
          customerId: customerSession.customerId,
          customerName: customerSession.name,
          phone: customerSession.phone,
          location: customerSession.location,
          address: customerSession.address
        }
      : {
          customerId: '',
          customerName: customerForm.name,
          phone: customerForm.phone,
          location: customerForm.location,
          address: customerForm.address
        }

    if (!String(effectiveCustomer.customerName || '').trim() || !normalizePhone(effectiveCustomer.phone)) {
      toast.error('Ad soyad ve telefon zorunlu')
      return
    }

    setPlacing(true)
    try {
      const res = await api('/api/public/online-store/orders', {
        method: 'POST',
        body: JSON.stringify({
          tenantSlug,
          branchId,
          customerId: effectiveCustomer.customerId,
          customerName: effectiveCustomer.customerName,
          phone: normalizePhone(effectiveCustomer.phone),
          location: effectiveCustomer.location,
          address: effectiveCustomer.address,
          note: customerForm.note,
          deliveryPaymentStatus: 'pay_on_delivery',
          deliveryPaymentMethod: selectedPaymentMethod,
          items: cartRows.map((row) => ({
            menuItemId: row.item.id,
            quantity: row.quantity,
            note: row.note,
            weightGrams: row.weightGrams,
            portionKey: row.portionKey
          }))
        }),
        silent: true,
        skipBranchHeader: true
      })
      if (res?.success === false) throw new Error(res?.message || 'Siparis olusturulamadi')
      setSuccessOrder(res?.order || null)
      setCartLines([])
      setCustomerForm(CUSTOMER_FORM)
      setView('success')
      if (customerSession?.customerId) await loadCustomerProfile(customerSession)
      toast.success('Siparisiniz alindi')
    } catch (err) {
      toast.error(err?.message || 'Siparis olusturulamadi')
    } finally {
      setPlacing(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>Yukleniyor...</div>
  }

  if (error) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, color: '#b91c1c' }}>{error}</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#e7e7e7', padding: isDesktop ? 18 : 0 }}>
      <style>{`
        .online-shell{max-width:1320px;min-height:calc(100vh - 36px);margin:0 auto;border-radius:${isDesktop ? '34px' : '0'};background:#f8f8f7;display:grid;grid-template-columns:${isDesktop ? '300px minmax(0,1fr)' : '1fr'};overflow:hidden;box-shadow:${isDesktop ? '0 20px 60px rgba(15,23,42,.16)' : 'none'}}
        .online-sidebar{display:${isDesktop ? 'grid' : 'none'};grid-template-rows:auto 1fr;gap:15px;padding:18px;border-right:1px solid rgba(17,24,39,.12);background:linear-gradient(180deg,#f5f5f4,#f8f8f7)}
        .online-brand-card{position:relative;min-height:232px;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#d4d4d8,#27272a)}
        .online-brand-card::before{content:"";position:absolute;inset:0;background:${tenant?.logoUrl ? `url(${tenant.logoUrl}) center/cover` : 'linear-gradient(180deg,#d4d4d8,#27272a)'};opacity:${tenant?.logoUrl ? '.34' : '1'}}
        .online-brand-card::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.04) 0%,rgba(24,24,27,.16) 38%,rgba(24,24,27,.68) 100%)}
        .online-brand-card h1{position:absolute;left:21px;right:21px;bottom:20px;z-index:1;margin:0;color:#fff;font-size:44px;line-height:.88;font-style:italic;font-weight:900;letter-spacing:-.05em;overflow-wrap:anywhere}
        .online-side-nav{display:grid;gap:10px;align-content:start}
        .online-side-btn,.online-mobile-menu button{border:0;border-radius:15px;background:#ececeb;color:#0f172a;padding:14px 14px;font:inherit;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:space-between;box-shadow:inset 0 1px 0 rgba(255,255,255,.72)}
        .online-side-btn.is-active{background:#f0f4f8}
        .online-side-count,.online-cart-count{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:999px;background:#fff;color:#0f172a;font-size:14px;font-weight:900}
        .online-main{display:grid;min-height:100vh}
        .online-mobile-hero{display:${isDesktop ? 'none' : 'grid'};position:relative;min-height:168px;background:linear-gradient(180deg,#d4d4d8,#27272a);overflow:hidden}
        .online-mobile-hero::before{content:"";position:absolute;inset:0;background:${tenant?.logoUrl ? `url(${tenant.logoUrl}) center/cover` : 'linear-gradient(180deg,#d4d4d8,#27272a)'};opacity:${tenant?.logoUrl ? '.34' : '1'}}
        .online-mobile-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(24,24,27,.58))}
        .online-mobile-hero h1{position:absolute;left:18px;right:18px;bottom:36px;z-index:1;margin:0;text-align:center;color:#fff;font-size:40px;line-height:.9;font-style:italic;font-weight:900;letter-spacing:-.05em;overflow-wrap:anywhere}
        .online-mobile-menu-btn{display:${isDesktop ? 'none' : 'none'};position:absolute;right:14px;top:14px;z-index:2;width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.18);color:#fff;font-size:14px;font-weight:900}
        .online-mobile-menu{display:none}
        .online-content{padding:${isDesktop ? '24px' : '8px 8px 96px'};display:grid;gap:${isDesktop ? '20px' : '10px'};align-content:start;width:100%;max-width:100%;box-sizing:border-box;overflow-x:hidden}
        .online-topbar{display:grid;grid-template-columns:${isDesktop ? 'minmax(0,1fr) auto auto' : 'repeat(2,minmax(0,1fr))'};gap:${isDesktop ? '14px' : '8px'};align-items:center;min-height:${isDesktop ? '112px' : 'auto'};padding:${isDesktop ? '18px' : '0'};border:${isDesktop ? '1px solid rgba(17,24,39,.12)' : '0'};border-radius:${isDesktop ? '30px' : '0'};background:${isDesktop ? '#f1efed' : 'transparent'};box-sizing:border-box}
        .online-search{display:flex;align-items:center;gap:8px;height:42px;padding:0 14px;border:1px solid rgba(17,24,39,.12);border-radius:16px;background:#f5f3f1;color:#64748b;grid-column:${isDesktop ? 'auto' : '1 / -1'};min-width:0}
        .online-search input{width:100%;border:0;outline:0;background:transparent;color:#475569;font:inherit;font-size:12px}
        .online-search-pill,.online-cart-pill{display:${isDesktop ? 'inline-flex' : 'none'};align-items:center;justify-content:center;gap:8px;height:42px;padding:0 14px;border:1px solid rgba(17,24,39,.12);border-radius:16px;background:#f5f3f1;color:#111827;font-size:${isDesktop ? '16px' : '12px'};font-weight:800;white-space:nowrap;min-width:0;width:${isDesktop ? 'auto' : '100%'}}
        .online-layout{display:grid;grid-template-columns:${isDesktop ? 'minmax(0,1fr)' : '1fr'};gap:${isDesktop ? '20px' : '10px'};align-content:start}
        .online-panel{width:100%;max-width:100%;background:#fff;border:1px solid rgba(17,24,39,.10);border-radius:${isDesktop ? '20px' : '16px'};padding:${isDesktop ? '24px' : '10px'};box-shadow:0 12px 32px rgba(15,23,42,.06);box-sizing:border-box;overflow:hidden}
        .online-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:${isDesktop ? '16px' : '10px'};flex-wrap:${isDesktop ? 'nowrap' : 'wrap'}}
        .online-section-head h2{margin:0;color:#111827;font-size:${isDesktop ? '18px' : '13px'};font-weight:900}
        .online-link-btn{border:0;background:none;color:#111827;font:inherit;font-size:${isDesktop ? '16px' : '12px'};font-weight:800;padding:0}
        .online-category-grid{display:${isDesktop ? 'grid' : 'flex'};grid-template-columns:repeat(auto-fill,minmax(92px,92px));gap:${isDesktop ? '10px' : '2px'};overflow-x:${isDesktop ? 'visible' : 'auto'};flex-wrap:${isDesktop ? 'wrap' : 'nowrap'};width:100%;max-width:100%;padding-bottom:${isDesktop ? '0' : '4px'};overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
        .online-category-grid::-webkit-scrollbar{display:none}
        .online-category-btn{border:0;border-radius:${isDesktop ? '18px' : '999px'};min-width:${isDesktop ? '0' : '88px'};min-height:${isDesktop ? '82px' : '30px'};padding:${isDesktop ? '10px' : '0 10px'};background:#ececeb;color:#374151;font:inherit;font-size:${isDesktop ? '11px' : '11px'};font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.78);flex:0 0 auto}
        .online-category-btn.is-active{background:#f0f4f8;color:#0f172a}
        .online-products-grid{display:grid;grid-template-columns:${isDesktop ? 'repeat(3,minmax(0,1fr))' : '1fr'};gap:${isDesktop ? '13px' : '8px'}}
        .online-product-group{display:grid;gap:${isDesktop ? '14px' : '10px'}}
        .online-product-group + .online-product-group{margin-top:${isDesktop ? '8px' : '6px'}}
        .online-product-group-title{margin:0;color:#111827;font-size:${isDesktop ? '16px' : '13px'};font-weight:900}
        .online-product-card{display:grid;grid-template-columns:${isDesktop ? '1fr' : '54px minmax(0,1fr)'};gap:${isDesktop ? '11px' : '8px'};padding:${isDesktop ? '13px' : '10px'};border:1px solid rgba(17,24,39,.10);border-radius:${isDesktop ? '20px' : '16px'};background:#fff;cursor:pointer}
        .online-product-media{width:${isDesktop ? '100%' : '54px'};height:${isDesktop ? '128px' : '54px'};border-radius:${isDesktop ? '18px' : '14px'};overflow:hidden;background:#f1f5f9}
        .online-product-body{display:grid;gap:${isDesktop ? '8px' : '5px'};min-width:0}
        .online-product-body h3{margin:0;color:#111827;font-size:${isDesktop ? '14px' : '11px'};line-height:1.2;font-weight:900}
        .online-product-body p{margin:0;color:#475569;font-size:${isDesktop ? '12px' : '11px'};line-height:1.3}
        .online-product-meta{display:flex;align-items:center;justify-content:space-between;gap:${isDesktop ? '12px' : '8px'};flex-wrap:wrap}
        .online-price-pill{display:inline-flex;align-items:center;justify-content:center;padding:${isDesktop ? '8px 12px' : '6px 10px'};border-radius:999px;background:#f8fafc;border:1px solid rgba(17,24,39,.10);color:#0f172a;font-size:${isDesktop ? '13px' : '11px'};font-weight:900}
        .online-primary,.online-secondary,.online-full{border:0;border-radius:18px;font:inherit;font-weight:900}
        .online-primary,.online-full{background:#111827;color:#fff}
        .online-secondary{background:#ececeb;color:#111827}
        .online-primary{min-height:${isDesktop ? '42px' : '34px'};padding:${isDesktop ? '0 14px' : '0 10px'};font-size:${isDesktop ? '13px' : '11px'}}
        .online-full{width:100%;min-height:${isDesktop ? '54px' : '42px'};padding:${isDesktop ? '0 18px' : '0 14px'}}
        .online-full:disabled,.online-primary:disabled{opacity:.6}
        .online-detail-grid{display:grid;grid-template-columns:${isDesktop ? 'minmax(220px,260px) minmax(0,1fr)' : '1fr'};gap:18px;align-items:start}
        .online-detail-image{width:100%;aspect-ratio:1/1;border-radius:24px;overflow:hidden;background:#f5f3f1}
        .online-detail-stack{display:grid;gap:14px}
        .online-note,.online-empty,.online-contact,.online-order-card,.online-account-card{padding:${isDesktop ? '16px' : '10px'};border-radius:${isDesktop ? '22px' : '14px'};background:#f8fafc;border:1px solid rgba(17,24,39,.08)}
        .online-note,.online-empty{color:#475569}
        .online-empty{text-align:center}
        .online-contact strong,.online-order-card strong,.online-account-card strong{color:#111827}
        .online-field{display:grid;gap:6px}
        .online-field input,.online-field textarea{width:100%;border:1px solid rgba(17,24,39,.12);border-radius:${isDesktop ? '18px' : '14px'};background:#f5f3f1;padding:${isDesktop ? '15px 16px' : '11px 12px'};color:#334155;font:inherit;outline:0}
        .online-field textarea{min-height:${isDesktop ? '108px' : '84px'};resize:vertical}
        .online-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .online-cart-row{display:grid;grid-template-columns:${isDesktop ? '64px minmax(0,1fr) auto' : '52px minmax(0,1fr) auto'};gap:${isDesktop ? '12px' : '8px'};align-items:center;padding:${isDesktop ? '12px 0' : '8px 0'};border-bottom:1px solid rgba(17,24,39,.08)}
        .online-cart-row:last-child{border-bottom:0}
        .online-cart-note-btn{border:0;background:none;color:#475569;font:inherit;font-size:${isDesktop ? '13px' : '9px'};font-weight:800;padding:0}
        .online-cart-inline-note{margin-top:4px;color:#64748b;font-size:${isDesktop ? '12px' : '9px'}}
        .online-qty{display:flex;align-items:center;gap:${isDesktop ? '8px' : '6px'}}
        .online-qty button{width:${isDesktop ? '30px' : '24px'};height:${isDesktop ? '30px' : '24px'};border-radius:999px;border:0;background:#ececeb;color:#111827;font-weight:900}
        .online-switch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${isDesktop ? '8px' : '6px'};padding:${isDesktop ? '6px' : '4px'};border-radius:${isDesktop ? '20px' : '16px'};background:#f5f3f1}
        .online-switch button{border:0;border-radius:${isDesktop ? '16px' : '12px'};padding:${isDesktop ? '12px 10px' : '9px 8px'};background:transparent;color:#475569;font:inherit;font-weight:800}
        .online-switch button.is-active{background:#fff;color:#111827;box-shadow:0 6px 20px rgba(15,23,42,.08)}
        .online-bottom-nav{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:10;display:${isDesktop ? 'none' : 'grid'};grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;width:min(calc(100% - 12px),420px);padding:8px;border-radius:20px;background:rgba(255,255,255,.96);box-shadow:0 20px 40px rgba(15,23,42,.18)}
        .online-bottom-nav button{border:0;border-radius:14px;background:transparent;color:#111827;font:inherit;font-size:11px;font-weight:800;padding:7px 4px;display:grid;place-items:center;gap:4px}
        .online-bottom-nav button.is-active{background:#f3f4f6}
      `}</style>

      <div className="online-shell">
        <aside className="online-sidebar">
          <div className="online-brand-card">
            <h1>{brandName}</h1>
          </div>

          <div className="online-side-nav">
            <button type="button" className={`online-side-btn${view === 'home' ? ' is-active' : ''}`} onClick={openHome}><span>Ana Sayfa</span></button>
            <button type="button" className={`online-side-btn${view === 'contact' ? ' is-active' : ''}`} onClick={() => setView('contact')}><span>Iletisim</span></button>
            <button type="button" className={`online-side-btn${view === 'account' ? ' is-active' : ''}`} onClick={() => setView('account')}><span>Hesabim</span></button>
            <button type="button" className={`online-side-btn${view === 'cart' ? ' is-active' : ''}`} onClick={() => setView('cart')}>
              <span>Sepetim</span>
              <span className="online-side-count">{cartCount}</span>
            </button>
          </div>
        </aside>

        <main className="online-main">
          <div className="online-mobile-hero">
            <button type="button" className="online-mobile-menu-btn" onClick={() => setMenuOpen((current) => !current)}>≡</button>
            <div className="online-mobile-menu">
              <button type="button" onClick={openHome}>Ana Sayfa</button>
              <button type="button" onClick={() => { setView('contact'); setMenuOpen(false) }}>Iletisim</button>
              <button type="button" onClick={() => { setView('account'); setMenuOpen(false) }}>Hesabim</button>
              <button type="button" onClick={() => { setView('cart'); setMenuOpen(false) }}>Sepetim</button>
            </div>
            <h1>{brandName}</h1>
          </div>

          <div className="online-content">
            <div className="online-topbar">
              <label className="online-search">
                <span>Ara</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Urun, kategori ara..." />
              </label>
              <div className="online-search-pill">{customerSession?.customerId ? customerSession.name : 'Misafir Musteri'}</div>
              <button type="button" className="online-cart-pill" onClick={() => setView('cart')}>
                <span>Sepet</span>
                <span className="online-cart-count">{cartCount}</span>
              </button>
            </div>

            <div className="online-layout">
              {view === 'home' && (
                <div style={{ display: 'grid', gap: 20 }}>
                  <section className="online-panel">
                    <div className="online-section-head">
                      <h2>Kategoriler</h2>
                    </div>

                    <div className="online-category-grid">
                      {(categories || []).map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          className={`online-category-btn${String(activeCategoryId) === String(category.id) ? ' is-active' : ''}`}
                          onClick={() => setActiveCategoryId(String(category.id || ''))}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                    {categories.length === 0 ? <div className="online-empty" style={{ marginTop: 12 }}>Uygun kategori bulunamadi.</div> : null}
                  </section>

                  <section className="online-panel">
                    <div className="online-section-head">
                      <h2>{activeCategoryName}</h2>
                    </div>

                    {activeCategoryId === 'all' ? (
                      <div style={{ display: 'grid', gap: isDesktop ? 18 : 14 }}>
                        {groupedFilteredItems.map((group) => (
                          <div key={group.categoryId || group.categoryName} className="online-product-group">
                            <h3 className="online-product-group-title">{group.categoryName}</h3>
                            <div className="online-products-grid">
                              {group.items.map((item) => (
                                <article
                                  key={item.id}
                                  className="online-product-card"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openProductDetail(item)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      openProductDetail(item)
                                    }
                                  }}
                                >
                                  <div className="online-product-media">
                                    <ProductImage product={item} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                  <div className="online-product-body">
                                    <h3>{item.name}</h3>
                                    <p>{item.description || 'Detaylar icin dokunun.'}</p>
                                    <div className="online-product-meta">
                                      <span className="online-price-pill">{money(item.price)}</span>
                                      <button
                                        type="button"
                                        className="online-primary"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          addToCart(item)
                                        }}
                                      >
                                        Sepete Ekle
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="online-products-grid">
                        {filteredItems.map((item) => (
                          <article
                            key={item.id}
                            className="online-product-card"
                            role="button"
                            tabIndex={0}
                            onClick={() => openProductDetail(item)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openProductDetail(item)
                              }
                            }}
                          >
                            <div className="online-product-media">
                              <ProductImage product={item} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div className="online-product-body">
                              <h3>{item.name}</h3>
                              <p>{item.description || 'Detaylar icin dokunun.'}</p>
                              <div className="online-product-meta">
                                <span className="online-price-pill">{money(item.price)}</span>
                                <button
                                  type="button"
                                  className="online-primary"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    addToCart(item)
                                  }}
                                >
                                  Sepete Ekle
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                    {filteredItems.length === 0 ? <div className="online-empty">Bu kategoride urun bulunamadi.</div> : null}
                  </section>
                </div>
              )}

              {view === 'cart' && (
                <section className="online-panel">
                  <div className="online-section-head">
                    <h2>Sepetim</h2>
                  </div>
                  <p style={{ margin: 0, color: '#64748b', fontSize: isDesktop ? 14 : 11 }}>Siparis sadece bu ekrandan tamamlanir.</p>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {cartRows.map((row) => (
                      <div key={row.key} className="online-cart-row">
                        <ProductImage product={row.item} alt={row.item.name} style={{ width: isDesktop ? 64 : 52, height: isDesktop ? 64 : 52, borderRadius: 18, objectFit: 'cover' }} />
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: isDesktop ? 16 : 12, lineHeight: 1.2 }}>{row.displayName}</strong>
                          <div style={{ marginTop: 4, color: '#64748b', fontSize: isDesktop ? 14 : 11 }}>
                            {row.weightGrams ? `${row.weightGrams} gr • ${money(row.unitPrice)}/KG` : `${row.quantity} x ${money(row.unitPrice)}`}
                          </div>
                          <button
                            type="button"
                            className="online-cart-note-btn"
                            onClick={() => {
                              setEditingNoteKey(row.key)
                              setItemNoteDraft(String(row.note || ''))
                            }}
                          >
                            {row.note ? 'Notu Duzenle' : 'Not Ekle'}
                          </button>
                          {row.note ? <div className="online-cart-inline-note">Not: {row.note}</div> : null}
                        </div>
                        <div className="online-qty">
                          <button type="button" onClick={() => updateCartLineQty(row.key, row.quantity - 1)}>-</button>
                          <strong>{row.quantity}</strong>
                          <button type="button" onClick={() => updateCartLineQty(row.key, row.quantity + 1)}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cartRows.length === 0 ? <div className="online-empty">Sepetiniz bos.</div> : null}

                  <div className="online-summary" style={{ marginTop: 10 }}>
                    <strong style={{ fontSize: isDesktop ? 18 : 13, color: '#111827' }}>Genel Toplam</strong>
                    <strong style={{ fontSize: isDesktop ? 28 : 20, color: '#111827' }}>{money(cartTotal)}</strong>
                  </div>

                  {customerSession?.customerId ? (
                    <div className="online-account-card" style={{ marginTop: 16 }}>
                      <strong>Siparis kayitli hesabiniza baglanacak</strong>
                      <div style={{ marginTop: 6 }}>{customerSession.name} • {customerSession.phone}</div>
                      <div style={{ marginTop: 6 }}>{customerSession.location || customerSession.address || 'Lokasyon hesap bilgisinden alinacak'}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                      <label className="online-field"><input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ad Soyad *" /></label>
                      <label className="online-field"><input value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                      <label className="online-field"><input value={customerForm.location} onChange={(event) => setCustomerForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lokasyon / Kat / Daire" /></label>
                      <label className="online-field"><input value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" /></label>
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <strong style={{ fontSize: isDesktop ? 15 : 12, color: '#111827' }}>Odeme Yontemi</strong>
                    <div
                      className="online-switch"
                      style={{ gridTemplateColumns: `repeat(${ONLINE_PAYMENT_OPTIONS.length}, minmax(0, 1fr))` }}
                    >
                      {ONLINE_PAYMENT_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={selectedPaymentMethod === option.key ? ' is-active' : ''}
                          onClick={() => setSelectedPaymentMethod(option.key)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="online-field" style={{ marginTop: 12 }}><textarea value={customerForm.note} onChange={(event) => setCustomerForm((current) => ({ ...current, note: event.target.value }))} placeholder="Siparis notu" /></label>
                  <button type="button" className="online-full" style={{ marginTop: 16 }} disabled={placing || cartRows.length === 0} onClick={submitOrder}>
                    {placing ? 'Siparis olusturuluyor...' : 'Siparisi Tamamla'}
                  </button>
                </section>
              )}

              {view === 'contact' && (
                <section className="online-panel">
                  <div className="online-section-head">
                    <h2>Iletisim</h2>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {contact?.phone ? <div className="online-contact"><strong>Telefon</strong><div style={{ marginTop: 6 }}>{contact.phone}</div></div> : null}
                    {contact?.whatsapp ? <div className="online-contact"><strong>WhatsApp</strong><div style={{ marginTop: 6 }}>{contact.whatsapp}</div></div> : null}
                    {contact?.email ? <div className="online-contact"><strong>E-posta</strong><div style={{ marginTop: 6 }}>{contact.email}</div></div> : null}
                    {contact?.address ? <div className="online-contact"><strong>Adres</strong><div style={{ marginTop: 6 }}>{contact.address}</div></div> : null}
                    {contact?.workingHours ? <div className="online-contact"><strong>Calisma Saatleri</strong><div style={{ marginTop: 6 }}>{contact.workingHours}</div></div> : null}
                  </div>
                  {!contact?.phone && !contact?.whatsapp && !contact?.email && !contact?.address && !contact?.workingHours ? (
                    <div className="online-empty">Iletisim bilgisi henuz tanimlanmamis.</div>
                  ) : null}
                </section>
              )}

              {view === 'account' && (
                <section className="online-panel">
                  <div className="online-section-head">
                    <h2>Hesabim</h2>
                    {customerSession?.customerId ? <button type="button" className="online-link-btn" onClick={logoutAccount}>Cikis</button> : null}
                  </div>

                  {!customerSession?.customerId ? (
                    <>
                      <div className="online-switch">
                        <button type="button" className={accountMode === 'login' ? ' is-active' : ''} onClick={() => setAccountMode('login')}>Mevcut Hesap</button>
                        <button type="button" className={accountMode === 'register' ? ' is-active' : ''} onClick={() => setAccountMode('register')}>Yeni Hesap</button>
                      </div>

                      {accountMode === 'login' ? (
                        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                          <div className="online-note">Mevcut hesapta sadece telefon ve sifre ile giris yapilir.</div>
                          <label className="online-field"><input value={loginForm.phone} onChange={(event) => setLoginForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                          <label className="online-field"><input type="password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} placeholder="Sifre *" /></label>
                          <button type="button" className="online-full" onClick={submitLogin}>Giris Yap</button>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                          <div className="online-note">Yeni hesapta ad soyad, telefon, sifre ve sifre tekrar zorunludur.</div>
                          <label className="online-field"><input value={registerForm.name} onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ad Soyad *" /></label>
                          <label className="online-field"><input value={registerForm.phone} onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                          <label className="online-field"><input type="password" value={registerForm.password} onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))} placeholder="Sifre *" /></label>
                          <label className="online-field"><input type="password" value={registerForm.passwordRepeat} onChange={(event) => setRegisterForm((current) => ({ ...current, passwordRepeat: event.target.value }))} placeholder="Sifre Tekrar *" /></label>
                          <label className="online-field"><input value={registerForm.location} onChange={(event) => setRegisterForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lokasyon / Kat / Daire" /></label>
                          <label className="online-field"><input value={registerForm.address} onChange={(event) => setRegisterForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" /></label>
                          <button type="button" className="online-full" onClick={submitRegister}>Hesap Olustur</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div className="online-account-card">
                        <strong style={{ fontSize: isDesktop ? 18 : 15 }}>{customerSession.name}</strong>
                        <div style={{ marginTop: 6, fontSize: isDesktop ? 16 : 13 }}>{customerSession.phone}</div>
                        <div style={{ marginTop: 6, fontSize: isDesktop ? 15 : 12 }}>{customerSession.location || 'Lokasyon girilmemis'}</div>
                        <div style={{ marginTop: 6, fontSize: isDesktop ? 15 : 12 }}>{customerSession.address || 'Adres girilmemis'}</div>
                        <div style={{ marginTop: 8, fontSize: isDesktop ? 15 : 12, fontWeight: 800, color: Number(customerProfile?.customer?.balance || 0) > 0 ? '#b45309' : '#111827' }}>
                          Bakiye: {money(customerProfile?.customer?.balance || 0)}
                        </div>
                      </div>

                      <div className="online-section-head" style={{ marginBottom: 0 }}>
                        <h2 style={{ fontSize: 16 }}>Hesap Bilgileri</h2>
                        <button
                          type="button"
                          className="online-link-btn"
                          onClick={() => {
                            if (profileEditing) {
                              setProfileForm({
                                name: customerSession?.name || '',
                                phone: customerSession?.phone || '',
                                location: customerSession?.location || '',
                                address: customerSession?.address || ''
                              })
                            }
                            setProfileEditing((current) => !current)
                          }}
                        >
                          {profileEditing ? 'Vazgec' : 'Duzenle'}
                        </button>
                      </div>

                      {profileEditing ? (
                        <div style={{ display: 'grid', gap: 12 }}>
                          <label className="online-field"><input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ad Soyad *" /></label>
                          <label className="online-field"><input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                          <label className="online-field"><input value={profileForm.location} onChange={(event) => setProfileForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lokasyon / Kat / Daire" /></label>
                          <label className="online-field"><input value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" /></label>
                          <button type="button" className="online-full" onClick={submitProfileUpdate} disabled={profileSaving}>
                            {profileSaving ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}
                          </button>
                        </div>
                      ) : null}

                      <div style={{ display: 'grid', gap: 12 }}>
                        <h2 style={{ margin: 0, fontSize: isDesktop ? 16 : 14, color: '#111827' }}>Eski Siparislerim</h2>
                        {Array.isArray(customerProfile?.orders) && customerProfile.orders.length > 0 ? customerProfile.orders.map((order) => (
                          <div key={order.id} className="online-order-card">
                            <div className="online-summary">
                              <strong style={{ fontSize: isDesktop ? 16 : 13 }}>{order.orderNo ? `Siparis ${order.orderNo}` : 'Siparis'}</strong>
                              <strong style={{ fontSize: isDesktop ? 16 : 13 }}>{money(order.total)}</strong>
                            </div>
                            <div style={{ marginTop: 6, color: '#64748b', fontSize: isDesktop ? 14 : 11 }}>{order.createdAt ? new Date(order.createdAt).toLocaleString('tr-TR') : '-'}</div>
                            <div style={{ marginTop: 6, color: '#64748b', fontSize: isDesktop ? 14 : 11 }}>
                              {getOnlineOrderStatusLabel(order)}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                              <button type="button" className="online-secondary" style={{ minHeight: isDesktop ? 34 : 30, padding: isDesktop ? '0 12px' : '0 10px', fontSize: isDesktop ? 14 : 11, fontWeight: 800 }} onClick={() => setSelectedHistoryOrder(order)}>Detay</button>
                              <button type="button" className="online-secondary" style={{ minHeight: isDesktop ? 34 : 30, padding: isDesktop ? '0 12px' : '0 10px', fontSize: isDesktop ? 14 : 11, fontWeight: 800 }} onClick={() => repeatOnlineOrder(order)}>Siparisi Tekrarla</button>
                              {order.cancelRequestStatus !== 'pending' && String(order.deliveryStatus || '') !== 'cancelled' ? (
                                <button type="button" className="online-secondary" style={{ minHeight: isDesktop ? 34 : 30, padding: isDesktop ? '0 12px' : '0 10px', fontSize: isDesktop ? 14 : 11, fontWeight: 800 }} onClick={() => requestOrderCancellation(order)}>Iptal Talebi</button>
                              ) : null}
                            </div>
                          </div>
                        )) : <div className="online-empty">Eski online siparis bulunamadi.</div>}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {view === 'success' && (
                <section className="online-panel">
                  <div className="online-section-head">
                    <h2>Siparisiniz alindi</h2>
                  </div>
                  <div className="online-note">Siparis paket siparislere dustu. Onay verilince hazirlanmaya ve kurye ekranina gececek.</div>
                  <div className="online-order-card">
                    <div className="online-summary"><strong>Siparis No</strong><strong>{successOrder?.orderNo || '-'}</strong></div>
                    <div className="online-summary" style={{ marginTop: 8 }}><strong>Durum</strong><strong>{getOnlineOrderStatusLabel(successOrder)}</strong></div>
                    <div className="online-summary" style={{ marginTop: 8 }}><strong>Toplam</strong><strong>{money(successOrder?.total || 0)}</strong></div>
                  </div>
                  {!customerSession?.customerId ? <button type="button" className="online-full" onClick={() => setView('account')}>Hesap Ac ve Takip Et</button> : null}
                  <button type="button" className="online-full" onClick={openHome}>Menuye Don</button>
                </section>
              )}
            </div>
          </div>

          <nav className="online-bottom-nav">
            <button type="button" className={view === 'home' ? 'is-active' : ''} onClick={openHome}>Ana Sayfa</button>
            <button type="button" className={view === 'cart' ? 'is-active' : ''} onClick={() => setView('cart')}>Sepet</button>
            <button type="button" className={view === 'contact' ? 'is-active' : ''} onClick={() => setView('contact')}>Iletisim</button>
            <button type="button" className={view === 'account' ? 'is-active' : ''} onClick={() => setView('account')}>Hesabim</button>
          </nav>

          <Modal
            open={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            title={selectedProduct?.name || 'Urun Detayi'}
            backdropClose
            dialogStyle={{ width: 'min(92vw, 760px)' }}
          >
            {selectedProduct ? (
              <div className="online-detail-grid">
                <div className="online-detail-image">
                  <ProductImage product={selectedProduct} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div className="online-detail-stack">
                  <div className="online-note">
                    <strong>{selectedProduct.categoryName || activeCategoryName || 'Urun'}</strong>
                    <div style={{ marginTop: 8, fontSize: 14 }}>{selectedProduct.description || 'Aciklama bulunmuyor.'}</div>
                  </div>
                  <div className="online-summary">
                    <strong style={{ fontSize: 18, color: '#111827' }}>Fiyat</strong>
                    <strong style={{ fontSize: 24, color: '#111827' }}>{money(selectedProduct.price)}</strong>
                  </div>
                  <button
                    type="button"
                    className="online-full"
                    onClick={() => {
                      addToCart(selectedProduct)
                      setSelectedProduct(null)
                    }}
                  >
                    Sepete Ekle
                  </button>
                </div>
              </div>
            ) : null}
          </Modal>

          <Modal
            open={!!configProduct}
            onClose={() => {
              setConfigProduct(null)
              setCartConfig(CART_CONFIG_FORM)
            }}
            title={configProduct?.name || 'Urun Secimi'}
            backdropClose
            dialogStyle={{ width: 'min(92vw, 520px)' }}
          >
            {configProduct ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {getPortionOptions(configProduct).length > 1 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <strong>Porsiyon Secin</strong>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {getPortionOptions(configProduct).map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={cartConfig.portionKey === option.key ? 'online-full' : 'online-secondary'}
                          onClick={() => setCartConfig((current) => ({ ...current, portionKey: option.key }))}
                          style={{ minHeight: 42 }}
                        >
                          {option.label} - {money(option.price)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {configProduct?.isWeightBased ? (
                  <label className="online-field">
                    <strong>Gramaj</strong>
                    <input
                      value={cartConfig.grams}
                      onChange={(event) => setCartConfig((current) => ({ ...current, grams: event.target.value }))}
                      placeholder="Ornek: 250"
                    />
                  </label>
                ) : null}

                <button type="button" className="online-full" onClick={submitCartConfig}>Sepete Ekle</button>
              </div>
            ) : null}
          </Modal>

          <Modal
            open={!!editingNoteKey}
            onClose={() => {
              setEditingNoteKey('')
              setItemNoteDraft('')
            }}
            title="Urun Notu"
            backdropClose
            dialogStyle={{ width: 'min(92vw, 520px)' }}
          >
            <div style={{ display: 'grid', gap: 14 }}>
              <label className="online-field">
                <textarea value={itemNoteDraft} onChange={(event) => setItemNoteDraft(event.target.value)} placeholder="Bu urune ozel not" />
              </label>
              <button
                type="button"
                className="online-full"
                onClick={() => {
                  updateCartLineNote(editingNoteKey, itemNoteDraft)
                  setEditingNoteKey('')
                  setItemNoteDraft('')
                }}
              >
                Notu Kaydet
              </button>
            </div>
          </Modal>

          <Modal
            open={!!selectedHistoryOrder}
            onClose={() => setSelectedHistoryOrder(null)}
            title={selectedHistoryOrder?.orderNo ? `Siparis ${selectedHistoryOrder.orderNo}` : 'Siparis Detayi'}
            backdropClose
            dialogStyle={{ width: 'min(92vw, 720px)' }}
          >
            {selectedHistoryOrder ? (
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="online-order-card">
                  <div className="online-summary" style={{ fontSize: isDesktop ? 16 : 12 }}><strong>Tarih</strong><strong>{selectedHistoryOrder.createdAt ? new Date(selectedHistoryOrder.createdAt).toLocaleString('tr-TR') : '-'}</strong></div>
                  <div className="online-summary" style={{ marginTop: 8 }}>
                    <strong>Durum</strong>
                    <strong>
                      {getOnlineOrderStatusLabel(selectedHistoryOrder)}
                    </strong>
                  </div>
                  <div className="online-summary" style={{ marginTop: 8, fontSize: isDesktop ? 15 : 12 }}>
                    <strong>Toplam</strong>
                    <strong>{money(selectedHistoryOrder.total || 0)}</strong>
                  </div>
                  {!!String(selectedHistoryOrder.note || '').trim() && <div style={{ marginTop: 8, color: '#64748b' }}>Genel Not: {selectedHistoryOrder.note}</div>}
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {(Array.isArray(selectedHistoryOrder.items) ? selectedHistoryOrder.items : []).map((item) => (
                    <div
                      key={item.id || `${item.name}-${item.quantity}`}
                      className="online-order-card"
                      style={{
                        padding: isDesktop ? 18 : 12,
                        opacity: item.isCancelled ? 0.78 : 1,
                        borderColor: item.isCancelled ? '#fecaca' : undefined
                      }}
                    >
                      <div className="online-summary">
                        <strong style={{ fontSize: isDesktop ? 15 : 12, textDecoration: item.isCancelled ? 'line-through' : 'none' }}>{item.name}</strong>
                        <strong style={{ fontSize: isDesktop ? 15 : 12 }}>{money(item.totalPrice)}</strong>
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ color: '#64748b', fontSize: isDesktop ? 14 : 11 }}>
                          {Number(item.weightGrams || 0) > 0 ? `${Number(item.weightGrams || 0)} gr` : `${Number(item.quantity || 0)} adet`}
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: isDesktop ? 28 : 24,
                            padding: isDesktop ? '4px 10px' : '3px 8px',
                            borderRadius: 999,
                            fontSize: isDesktop ? 12 : 10,
                            fontWeight: 800,
                            background: getOnlineItemStatusStyle(item, selectedHistoryOrder).bg,
                            color: getOnlineItemStatusStyle(item, selectedHistoryOrder).color
                          }}
                        >
                          {getOnlineItemStatusLabel(item, selectedHistoryOrder)}
                        </span>
                      </div>
                      {!!String(item.note || '').trim() && <div style={{ marginTop: 6, color: '#64748b', fontSize: isDesktop ? 13 : 11 }}>Not: {item.note}</div>}
                      {item.isCancelled ? <div style={{ marginTop: 6, color: '#b91c1c', fontSize: isDesktop ? 13 : 11, fontWeight: 800 }}>Iptal</div> : null}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="online-full" style={{ minHeight: isDesktop ? 42 : 36, fontSize: isDesktop ? 15 : 12 }} onClick={() => repeatOnlineOrder(selectedHistoryOrder)}>Siparisi Tekrarla</button>
                  {selectedHistoryOrder.cancelRequestStatus !== 'pending' && String(selectedHistoryOrder.deliveryStatus || '') !== 'cancelled' ? (
                    <button type="button" className="online-secondary" style={{ minHeight: isDesktop ? 42 : 36, padding: isDesktop ? '0 16px' : '0 12px', fontSize: isDesktop ? 14 : 12 }} onClick={() => requestOrderCancellation(selectedHistoryOrder)}>Iptal Talebi Gonder</button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Modal>
        </main>
      </div>
    </div>
  )
}
