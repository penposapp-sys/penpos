import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { resolveProductImageUrl } from '../lib/productImage.js'
import { toast } from '../lib/toast.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { applyLimanMenuContent, normalizeLimanMenuText } from './limanMenuContent.js'
import './liman-menu.css'
import './PublicMenuLiman.css'

const messages = {
  tr: {
    loading: 'Menü yükleniyor…',
    loadError: 'Menü açılamadı',
    login: 'Giriş',
    all: 'Tümü',
    itemCount: (count) => `${count} ürün`,
    search: 'Ürün ya da kategori ara',
    clearSearch: 'Aramayı temizle',
    notFound: 'Bulunamadı',
    noResults: (query) => `“${query}” için ürün yok.`,
    noCategoryItems: 'Bu kategoride ürün yok.',
    table: 'Masa seç',
    tableNumber: (name, branch) => branch ? `${branch} · ${name}` : `Masa ${name}`,
    chooseTable: 'Masanızı seçin',
    tableHint: 'Masanın üstündeki numara.',
    noTables: 'Bu menü için kullanılabilir masa bulunamadı.',
    select: 'Seç',
    selectAndCall: 'Seç ve garson çağır',
    waiter: 'Garson çağır',
    waiterSending: 'Gönderiliyor…',
    waiterSuccess: (name) => `Garson çağrıldı · Masa ${name}`,
    close: 'Kapat',
    closeDialog: 'Pencereyi kapat',
    featured: 'Önerimiz',
    footer: 'Afiyet olsun',
    menuTitle: 'Menü',
    menuTitleAccent: 'Menüsü',
    organization: 'İşletme',
    language: 'English',
    categoryNav: 'Kategoriler',
    dialogProduct: 'Ürün ayrıntısı',
    dialogTable: 'Masa seçimi'
  },
  en: {
    loading: 'Loading menu…',
    loadError: 'Menu could not be opened',
    login: 'Login',
    all: 'All',
    itemCount: (count) => `${count} items`,
    search: 'Search products or categories',
    clearSearch: 'Clear search',
    notFound: 'Not found',
    noResults: (query) => `No products found for “${query}”.`,
    noCategoryItems: 'There are no items in this category.',
    table: 'Choose table',
    tableNumber: (name, branch) => branch ? `${branch} · Table ${name}` : `Table ${name}`,
    chooseTable: 'Choose your table',
    tableHint: 'Use the number on your table.',
    noTables: 'No tables are available for this menu.',
    select: 'Select',
    selectAndCall: 'Select and call waiter',
    waiter: 'Call waiter',
    waiterSending: 'Sending…',
    waiterSuccess: (name) => `Waiter called · Table ${name}`,
    close: 'Close',
    closeDialog: 'Close dialog',
    featured: 'Featured',
    footer: 'Enjoy your meal',
    menuTitle: 'Menu',
    menuTitleAccent: 'Menu',
    organization: 'Business',
    language: 'Türkçe',
    categoryNav: 'Categories',
    dialogProduct: 'Product details',
    dialogTable: 'Choose a table'
  }
}

const DISH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" />
  </svg>
)

function isVisibleItem(item) {
  return Boolean(item && typeof item === 'object' &&
    item.isActive !== false &&
    item.isDeleted !== true &&
    !item.deletedAt)
}

function menuDomId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function normalizeMenuPathSegment(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

function getMenuScrollTarget() {
  const appRoot = document.getElementById('root')
  const overflowY = appRoot ? window.getComputedStyle(appRoot).overflowY : ''
  return appRoot &&
    /(auto|scroll)/.test(overflowY) &&
    appRoot.scrollHeight > appRoot.clientHeight
    ? appRoot
    : window
}

function scrollToMenuCategory(category) {
  if (!category) return

  const scrollTarget = getMenuScrollTarget()
  const categoryRect = category.getBoundingClientRect()
  const scrollTargetTop = scrollTarget === window
    ? 0
    : scrollTarget.getBoundingClientRect().top + scrollTarget.clientTop
  const scrollMarginTop = Number.parseFloat(window.getComputedStyle(category).scrollMarginTop) || 0
  const scrollOffset = categoryRect.top - scrollTargetTop - scrollMarginTop

  if (scrollTarget === window) {
    window.scrollTo({ top: window.scrollY + scrollOffset, behavior: 'smooth' })
  } else {
    scrollTarget.scrollTo({ top: scrollTarget.scrollTop + scrollOffset, behavior: 'smooth' })
  }
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return `\u20BA${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const menuPalettes = {
  liman: {
    background: '#f9f6f1',
    surface: '#ffffff',
    surfaceMuted: '#f0ebe0',
    border: '#dfd7c5',
    mutedIcon: '#aea084',
    text: '#14191b',
    secondaryText: '#656d71',
    primary: '#005c75',
    primaryPressed: '#002e3d',
    accent: '#d85737',
    backdrop: 'rgba(0,28,38,.45)'
  },
  olive: {
    background: '#f5f6ef',
    surface: '#ffffff',
    surfaceMuted: '#e8ebdf',
    border: '#d5dac7',
    mutedIcon: '#879176',
    text: '#20271e',
    secondaryText: '#687263',
    primary: '#526b3c',
    primaryPressed: '#354827',
    accent: '#d85737',
    backdrop: 'rgba(24,35,20,.48)'
  },
  midnight: {
    background: '#172226',
    surface: '#202e33',
    surfaceMuted: '#293a40',
    border: '#3a4c51',
    mutedIcon: '#9eaaa6',
    text: '#f1f3ed',
    secondaryText: '#bdc7c2',
    primary: '#70b4c5',
    primaryPressed: '#438292',
    accent: '#d85737',
    backdrop: 'rgba(0,0,0,.62)'
  }
}

const menuFonts = {
  instrument: { body: '"Instrument Sans", system-ui, sans-serif', heading: '"Instrument Serif", Georgia, serif' },
  system: { body: 'Arial, sans-serif', heading: 'Georgia, serif' },
  serif: { body: 'Georgia, serif', heading: '"Instrument Serif", Georgia, serif' }
}

function ProductPicture({ item, large = false }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = String(item?.imageUrl || '').trim()

  useEffect(() => {
    setFailed(false)
  }, [item?.id, imageUrl])

  return (
    <div className={large ? 'lm-buyuk-gorsel' : 'lm-gorsel'}>
      {imageUrl && !failed
        ? <img src={resolveProductImageUrl(item)} alt={large ? item.name : ''} onError={() => setFailed(true)} />
        : DISH_ICON}
    </div>
  )
}

function LimanMenuCard({ item, labels, onOpen, showImages, showPrices, showDescriptions }) {
  return (
    <button
      type="button"
      className={`lm-urun${showImages ? '' : ' lm-urun--no-image'}`}
      onClick={() => onOpen(item)}
      aria-label={`${item.name}. ${labels.dialogProduct}`}
    >
      {showImages ? <ProductPicture item={item} /> : null}
      <span className="lm-urun-yazi">
        <span className="lm-ad">{item.name}</span>
        {showDescriptions && item.description ? <span className="lm-not">{item.description}</span> : null}
      </span>
      {showPrices ? <span className="lm-fiyat">{formatMoney(item.price)}</span> : null}
      <span className="lm-ok" aria-hidden="true">›</span>
    </button>
  )
}

export default function PublicMenuLiman() {
  const { tenantSlug, branchSlug, tableSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [failedLogoUrl, setFailedLogoUrl] = useState('')
  const [failedFeaturedImageUrl, setFailedFeaturedImageUrl] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTable, setSelectedTable] = useState(null)
  const [availableTables, setAvailableTables] = useState([])
  const [waiterCalling, setWaiterCalling] = useState(false)
  const [language, setLanguage] = useState('tr')
  const [dialog, setDialog] = useState(null)
  const [pendingTable, setPendingTable] = useState(null)
  const [notice, setNotice] = useState('')
  const [showNotice, setShowNotice] = useState(false)
  const dialogRef = useRef(null)
  const closeDialogRef = useRef(null)
  const openerRef = useRef(null)
  const noticeTimerRef = useRef(null)
  const touchStartYRef = useRef(null)
  const tableQrEntryRef = useRef(Boolean(
    (branchSlug && tableSlug) ||
    new URLSearchParams(location.search || '').get('tableId')
  ))

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    const fontLink = document.createElement('link')
    fontLink.rel = 'stylesheet'
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wdth,wght@75..100,400..700&family=Instrument+Serif:ital@0;1&display=swap'
    fontLink.dataset.limanMenuFonts = 'true'
    document.head.appendChild(fontLink)
    return () => fontLink.remove()
  }, [])

  useEffect(() => {
    document.body.classList.add('liman-menu-body')
    return () => document.body.classList.remove('liman-menu-body')
  }, [])

  useEffect(() => {
    let mounted = true
    const loadMenu = async () => {
      setLoading(true)
      setError('')
      try {
        const search = new URLSearchParams(location.search || '')
        const query = new URLSearchParams({ tenantSlug: String(tenantSlug || '').trim() })
        if (branchSlug && tableSlug) {
          query.set('branchSlug', branchSlug)
          query.set('tableSlug', tableSlug)
        }
        for (const key of ['tableId', 'table', 'tableName']) {
          const value = String(search.get(key) || '').trim()
          if (value) query.set(key, value)
        }
        const response = await api(`/api/public/menu?${query.toString()}`, {
          silent: true,
          skipBranchHeader: true
        })
        if (!mounted) return
        if (response?.success === false) {
          setError(response?.message || 'Menü bulunamadı')
          setTenant(null)
          setCategories([])
          setItems([])
          return
        }
        setTenant(response?.tenant || null)
        setCategories(Array.isArray(response?.categories) ? response.categories : [])
        setItems(Array.isArray(response?.items) ? response.items : [])
        setSelectedTable(response?.table || null)
        setAvailableTables(Array.isArray(response?.availableTables) ? response.availableTables : [])
        setSelectedCategory('')
      } catch (requestError) {
        if (!mounted) return
        setError(requestError?.message || 'Menü yüklenemedi')
        setTenant(null)
        setCategories([])
        setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadMenu()
    return () => { mounted = false }
  }, [tenantSlug, branchSlug, tableSlug, location.search])

  useEffect(() => {
    document.title = tenant?.name
      ? `${tenant.name} | Dijital Menü`
      : 'Dijital Menü'
  }, [tenant?.name])

  useEffect(() => {
    if (!dialog) return undefined
    const previousOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    if (closeDialogRef.current) closeDialogRef.current.focus()
    else dialogRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousRootOverflow
      const previousFocus = openerRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [dialog])

  useEffect(() => () => {
    window.clearTimeout(noticeTimerRef.current)
  }, [])

  const qrMenuSettings = tenant?.settings?.qrMenu || {}
  const waiterCallEnabled = qrMenuSettings.waiterCall === true
  const tableQrEnabled = qrMenuSettings.tableQrEnabled === true
  const showImages = qrMenuSettings.showProductImages !== false
  const showPrices = qrMenuSettings.showPrices !== false
  const showDescriptions = qrMenuSettings.showDescriptions !== false
  const showCategoryCounts = qrMenuSettings.showCategoryCounts !== false
  const labels = messages[language]
  const selectedPalette = menuPalettes[qrMenuSettings.palette] ? qrMenuSettings.palette : 'liman'
  const selectedFont = menuFonts[qrMenuSettings.fontFamily] ? qrMenuSettings.fontFamily : 'instrument'
  const menuStyle = useMemo(() => {
    const palette = menuPalettes[selectedPalette]
    const font = menuFonts[selectedFont]
    return {
      '--lm-zemin': palette.background,
      '--lm-yuzey': palette.surface,
      '--lm-yuzey-2': palette.surfaceMuted,
      '--lm-cizgi': palette.border,
      '--lm-ikon-soluk': palette.mutedIcon,
      '--lm-metin': palette.text,
      '--lm-metin-2': palette.secondaryText,
      '--lm-ana': palette.primary,
      '--lm-ana-basili': palette.primaryPressed,
      '--lm-vurgu': palette.accent,
      '--lm-perde': palette.backdrop,
      '--lm-font': font.body,
      '--lm-font-baslik': font.heading
    }
  }, [selectedPalette, selectedFont])

  const displayedContent = useMemo(
    () => applyLimanMenuContent(categories, items, qrMenuSettings),
    [categories, items, qrMenuSettings]
  )
  const categoryMap = useMemo(
    () => new Map(displayedContent.categories.map((category) => [String(category.id), category])),
    [displayedContent.categories]
  )
  const products = useMemo(() => displayedContent.items
    .filter(isVisibleItem)
    .map((item, index) => {
      const categoryId = String(item?.categoryId || '').trim()
      const category = categoryMap.get(categoryId)
      return {
        ...item,
        id: String(item?.id || item?._id || `${categoryId || 'product'}-${index}`),
        categoryId,
        categoryName: category?.name || item.categoryName || ''
      }
    })
    .sort((left, right) => {
      const leftCategory = categoryMap.get(left.categoryId)
      const rightCategory = categoryMap.get(right.categoryId)
      const categoryDifference = Number(leftCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        Number(rightCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER)
      if (categoryDifference) return categoryDifference
      const itemDifference = Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
      return itemDifference || String(left.name || '').localeCompare(String(right.name || ''), 'tr')
    }), [displayedContent.items, categoryMap])

  const normalizedSearch = normalizeLimanMenuText(searchTerm)
  const visibleProducts = useMemo(() => products.filter((item) => {
    const category = categoryMap.get(item.categoryId)
    const searchText = normalizeLimanMenuText(`${item.name} ${item.description || ''} ${category?.name || item.categoryName}`)
    return !normalizedSearch || searchText.includes(normalizedSearch)
  }), [products, categoryMap, normalizedSearch])

  const visibleGroups = useMemo(() => {
    const groups = new Map()
    for (const item of visibleProducts) {
      const key = item.categoryId || `uncategorized:${item.categoryName}`
      if (!groups.has(key)) {
        groups.set(key, {
          id: item.categoryId || key,
          name: categoryMap.get(item.categoryId)?.name || item.categoryName,
          items: []
        })
      }
      groups.get(key).items.push(item)
    }
    return [...groups.values()]
  }, [visibleProducts, categoryMap])

  const categoryTabs = useMemo(() => [
    ...displayedContent.categories.map((category) => ({
      id: String(category.id),
      name: category.name
    }))
  ], [displayedContent.categories])

  useEffect(() => {
    if (!categoryTabs.length) return undefined

    const appRoot = document.getElementById('root')
    let frame = 0
    const updateActiveCategory = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const scrollTarget = getMenuScrollTarget()
        const activationLine = window.innerWidth >= 1024 ? 130 : 100
        let activeId = categoryTabs[0].id
        const headings = [...document.querySelectorAll('#lm-menu-list .lm-kategori[data-category-id]')]

        for (const heading of headings) {
          const categoryId = heading.dataset.categoryId
          if (!categoryTabs.some((category) => category.id === categoryId)) continue
          if (heading.getBoundingClientRect().top > activationLine) break
          activeId = categoryId
        }

        const atBottom = scrollTarget === window
          ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8
          : scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 8
        if (atBottom) {
          const visibleHeadings = headings.filter((heading) => {
            const top = heading.getBoundingClientRect().top
            return top >= 0 && top < window.innerHeight &&
              categoryTabs.some((category) => category.id === heading.dataset.categoryId)
          })
          const nearestHeading = visibleHeadings.reduce((nearest, heading) => {
            if (!nearest) return heading
            const headingDistance = Math.abs(heading.getBoundingClientRect().top - activationLine)
            const nearestDistance = Math.abs(nearest.getBoundingClientRect().top - activationLine)
            return headingDistance < nearestDistance ? heading : nearest
          }, null)
          if (nearestHeading) activeId = nearestHeading.dataset.categoryId
        }

        setSelectedCategory((current) => current === activeId ? current : activeId)
      })
    }

    updateActiveCategory()
    appRoot?.addEventListener('scroll', updateActiveCategory, { passive: true })
    window.addEventListener('scroll', updateActiveCategory, { passive: true })
    window.addEventListener('resize', updateActiveCategory)
    return () => {
      window.cancelAnimationFrame(frame)
      appRoot?.removeEventListener('scroll', updateActiveCategory)
      window.removeEventListener('scroll', updateActiveCategory)
      window.removeEventListener('resize', updateActiveCategory)
    }
  }, [categoryTabs])

  useEffect(() => {
    const navigation = document.querySelector('.lm-sekmeler')
    const activeTab = document.getElementById(`lm-tab-${menuDomId(selectedCategory)}`)
    if (!navigation || !activeTab || window.innerWidth >= 1024) return

    const navigationRect = navigation.getBoundingClientRect()
    const tabRect = activeTab.getBoundingClientRect()
    if (tabRect.left < navigationRect.left) {
      navigation.scrollBy({ left: tabRect.left - navigationRect.left, behavior: 'smooth' })
    } else if (tabRect.right > navigationRect.right) {
      navigation.scrollBy({ left: tabRect.right - navigationRect.right, behavior: 'smooth' })
    }
  }, [selectedCategory])

  const featuredItem = useMemo(() => {
    const featuredId = String(qrMenuSettings.featuredProductId || '')
    return products.find((item) => item.id === featuredId) || products[0] || null
  }, [products, qrMenuSettings.featuredProductId])

  const openDialog = (nextDialog) => {
    openerRef.current = document.activeElement
    if (nextDialog.type === 'table') {
      setPendingTable(nextDialog.action === 'waiter'
        ? null
        : selectedTable?.id
          ? availableTables.find((table) => String(table.id) === String(selectedTable.id)) || null
          : null)
    }
    setDialog(nextDialog)
  }

  const showWaiterNotice = (tableName) => {
    setNotice(labels.waiterSuccess(tableName))
    setShowNotice(true)
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setShowNotice(false), 3000)
  }

  const callWaiter = async (table) => {
    if (!tenantSlug || !waiterCallEnabled || waiterCalling) return
    if (!table?.name) {
      openDialog({ type: 'table', action: 'waiter' })
      return
    }
    setWaiterCalling(true)
    try {
      const response = await api('/api/public/menu/waiter-call', {
        method: 'POST',
        body: JSON.stringify({
          tenantSlug,
          tableId: table.id || '',
          tableName: table.name || ''
        }),
        silent: true,
        skipBranchHeader: true
      })
      if (response?.success === false) {
        toast.error(response?.message || 'Garson çağrısı iletilemedi')
        return
      }
      showWaiterNotice(table.name)
    } catch (requestError) {
      toast.error(requestError?.message || 'Garson çağrısı iletilemedi')
    } finally {
      setWaiterCalling(false)
    }
  }

  const selectTable = async () => {
    if (!pendingTable) return
    const chosenTable = pendingTable
    const action = dialog?.action
    if (action === 'waiter' && !tableQrEntryRef.current) {
      setDialog(null)
      setPendingTable(null)
      try {
        await callWaiter(chosenTable)
      } finally {
        setSelectedTable(null)
        setPendingTable(null)
      }
      return
    }

    setSelectedTable(chosenTable)
    const branchSlug = normalizeMenuPathSegment(chosenTable.branchName)
    const tableSlug = normalizeMenuPathSegment(chosenTable.name)
    if (branchSlug && tableSlug) {
      tableQrEntryRef.current = true
      const remainingParams = new URLSearchParams(location.search || '')
      for (const key of ['tableId', 'table', 'tableName']) remainingParams.delete(key)
      const search = remainingParams.toString()
      navigate(
        `/menu/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(branchSlug)}/${encodeURIComponent(tableSlug)}${search ? `?${search}` : ''}`,
        { replace: true }
      )
    } else {
      const params = new URLSearchParams(location.search || '')
      params.set('tableId', String(chosenTable.id))
      params.set('table', String(chosenTable.name || ''))
      params.delete('tableName')
      navigate(`${location.pathname}?${params.toString()}`, { replace: true })
    }
    setDialog(null)
    if (action === 'waiter') await callWaiter(chosenTable)
  }

  const selectCategory = (categoryId, button) => {
    setSelectedCategory(categoryId)
    if (button) {
      const navigation = button.closest('.lm-sekmeler')
      const navigationRect = navigation?.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      if (navigationRect && buttonRect.left < navigationRect.left) {
        navigation.scrollBy({ left: buttonRect.left - navigationRect.left, behavior: 'smooth' })
      } else if (navigationRect && buttonRect.right > navigationRect.right) {
        navigation.scrollBy({ left: buttonRect.right - navigationRect.right, behavior: 'smooth' })
      }
    }
    scrollToMenuCategory(document.getElementById(`lm-category-${menuDomId(categoryId)}`))
  }

  const clearSearch = () => setSearchTerm('')
  const menuTitle = String(qrMenuSettings.title || '').trim() || tenant?.name || labels.menuTitle
  const menuSubtitle = String(qrMenuSettings.subtitle || '').trim() || labels.menuTitleAccent
  const menuDescription = String(qrMenuSettings.description || '').trim()
  const brandLabel = qrMenuSettings.brandLabel ?? tenant?.name ?? labels.organization
  const footerGreeting = qrMenuSettings.footerGreeting ?? labels.footer
  const footerText = qrMenuSettings.footerText ?? `${tenant?.name || labels.organization} · ${menuTitle}`
  const featuredImageUrl = String(qrMenuSettings.featuredImageUrl || featuredItem?.imageUrl || '').trim()
  const featuredDescription = String(qrMenuSettings.featuredDescription || featuredItem?.description || '').trim()

  if (loading) {
    return <div className="lm lm-state" role="status">{labels.loading}</div>
  }

  if (error) {
    return (
      <div className="lm lm-state">
        <h1>{labels.loadError}</h1>
        <p>{error}</p>
        <a className="lm-login-link" href="/login">{labels.login}</a>
      </div>
    )
  }

  return (
    <div className="lm" style={menuStyle}>
      <header className="lm-ust">
        {qrMenuSettings.showLogo !== false && tenant?.logoUrl && failedLogoUrl !== tenant.logoUrl ? (
          <img
            src={tenant.logoUrl}
            alt={`${tenant.name || labels.organization} logosu`}
            onError={() => setFailedLogoUrl(tenant.logoUrl)}
          />
        ) : null}
        {brandLabel ? <div className="lm-kurum">{brandLabel}</div> : null}
        <h1>{menuTitle}</h1>
        {menuSubtitle ? <p className="lm-header-subtitle"><i>{menuSubtitle}</i></p> : null}
        {menuDescription ? <p className="lm-header-description">{menuDescription}</p> : null}
        {qrMenuSettings.multiLanguage === true ? (
          <button
            type="button"
            className="lm-language"
            onClick={() => setLanguage((current) => current === 'tr' ? 'en' : 'tr')}
            aria-label={labels.language}
          >
            {language === 'tr' ? 'EN' : 'TR'}
          </button>
        ) : null}
      </header>

      <div className="lm-ufuk" />

      <div className="lm-bas">
        {qrMenuSettings.featuredEnabled !== false && featuredItem ? (
          <section className="lm-oneri" aria-label={labels.featured}>
            {featuredImageUrl && failedFeaturedImageUrl !== featuredImageUrl ? (
              <img
                className="lm-oneri-gorsel"
                src={resolveProductImageUrl({ imageUrl: featuredImageUrl })}
                alt=""
                onError={() => setFailedFeaturedImageUrl(featuredImageUrl)}
              />
            ) : null}
            <div className="lm-oneri-icerik">
              <div className="lm-etiket">{labels.featured}</div>
              <h2>{String(qrMenuSettings.featuredTitle || '').trim() || featuredItem.name}</h2>
              {featuredDescription ? <p>{featuredDescription}</p> : null}
            </div>
          </section>
        ) : null}

        <div className="lm-bas-sag">
          <div className="lm-eylem">
            <label className={`lm-ara${searchTerm ? ' dolu' : ''}`}>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={labels.search}
                aria-label={labels.search}
                autoComplete="off"
              />
              <button
                type="button"
                className="lm-temizle"
                aria-label={labels.clearSearch}
                onClick={clearSearch}
                tabIndex={searchTerm ? 0 : -1}
              >
                ×
              </button>
            </label>
            {waiterCallEnabled ? (
              <button
                type="button"
                className="lm-dugme lm-dugme--vurgu"
                onClick={() => {
                  if (tableQrEntryRef.current && selectedTable?.id) {
                    void callWaiter(selectedTable)
                    return
                  }
                  openDialog({ type: 'table', action: 'waiter' })
                }}
                disabled={waiterCalling}
              >
                {waiterCalling ? labels.waiterSending : labels.waiter}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="lm-govde">
        <nav className="lm-sekmeler" aria-label={labels.categoryNav}>
          {categoryTabs.map((category) => (
            <button
              key={category.id}
              type="button"
              className="lm-sekme"
              id={`lm-tab-${menuDomId(category.id)}`}
              aria-current={selectedCategory === category.id ? 'location' : undefined}
              aria-controls="lm-menu-list"
              onClick={(event) => selectCategory(category.id, event.currentTarget)}
            >
              {category.name}
            </button>
          ))}
        </nav>

        <div className="lm-list-column">
          <main id="lm-menu-list" tabIndex={-1}>
            {visibleProducts.length ? visibleGroups.map((group) => (
              <section key={group.id} aria-labelledby={`lm-category-${menuDomId(group.id)}`}>
                <div
                  className="lm-kategori"
                  id={`lm-category-${menuDomId(group.id)}`}
                  data-category-id={group.id}
                >
                  <h3>{group.name}</h3>
                  {showCategoryCounts ? <span>{labels.itemCount(group.items.length)}</span> : null}
                </div>
                <div className="lm-urunler">
                  {group.items.map((item) => (
                    <LimanMenuCard
                      key={item.id}
                      item={item}
                      labels={labels}
                      onOpen={(product) => openDialog({ type: 'product', product })}
                      showImages={showImages}
                      showPrices={showPrices}
                      showDescriptions={showDescriptions}
                    />
                  ))}
                </div>
              </section>
            )) : (
              <div className="lm-bos" role="status">
                <b>{labels.notFound}</b>
                <span>{normalizedSearch
                  ? labels.noResults(searchTerm.trim())
                  : labels.noCategoryItems}</span>
                {searchTerm ? (
                  <button type="button" onClick={clearSearch}>{labels.clearSearch}</button>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="lm-alt">
        {footerGreeting ? <b>{footerGreeting}</b> : null}
        {footerText ? <span>{footerText}</span> : null}
      </footer>

      {dialog ? (
        <>
          <div
            className="lm-perde acik"
            aria-hidden="true"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDialog(null)
            }}
          />
          <section
            ref={dialogRef}
            className={`lm-pencere${dialog.type === 'product' ? ' lm-pencere--urun' : ''} acik`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lm-dialog-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              setDialog(null)
            }}
            onTouchStart={(event) => {
              if (event.currentTarget.scrollTop === 0) {
                touchStartYRef.current = event.touches[0]?.clientY ?? null
              }
            }}
            onTouchEnd={(event) => {
              const start = touchStartYRef.current
              const end = event.changedTouches[0]?.clientY
              if (start !== null && end !== undefined && end - start >= 60) setDialog(null)
              touchStartYRef.current = null
            }}
          >
            <div className="lm-tutamak" aria-hidden="true" />
            <button
              ref={closeDialogRef}
              type="button"
              className="lm-dialog-close"
              aria-label={labels.closeDialog}
              onClick={() => setDialog(null)}
            >
              ×
            </button>
            {dialog.type === 'product' ? (
              <>
                {showImages ? <ProductPicture item={dialog.product} large /> : null}
                <h2 id="lm-dialog-title" className="lm-dialog-product-title">{dialog.product.name}</h2>
                <div className="lm-kat">{dialog.product.categoryName}</div>
                {showDescriptions && dialog.product.description
                  ? <p className="lm-aciklama">{dialog.product.description}</p>
                  : null}
                {showPrices ? <div className="lm-dialog-price">{formatMoney(dialog.product.price)}</div> : null}
                <button
                  type="button"
                  className="lm-dugme lm-dugme--ikincil lm-dialog-action"
                  onClick={() => setDialog(null)}
                >
                  {labels.close}
                </button>
              </>
            ) : (
              <>
                <h2 id="lm-dialog-title" className="lm-dialog-table-title">{labels.chooseTable}</h2>
                <p className="lm-aciklama">{labels.tableHint}</p>
                {availableTables.length ? (
                  <div className="lm-masalar">
                    {availableTables.map((table) => (
                      <button
                        key={table.id}
                        type="button"
                        className="lm-masa"
                        aria-pressed={String(pendingTable?.id || '') === String(table.id)}
                        onClick={() => setPendingTable(table)}
                      >
                        <span>{table.name}</span>
                        {table.branchName ? <small>{table.branchName}</small> : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="lm-no-tables" role="status">{labels.noTables}</p>
                )}
                <button
                  type="button"
                  className="lm-dugme lm-dugme--birincil lm-dialog-action"
                  disabled={!pendingTable}
                  onClick={selectTable}
                >
                  {dialog.action === 'waiter' ? labels.selectAndCall : labels.select}
                </button>
              </>
            )}
          </section>
        </>
      ) : null}

      <div className={`lm-bildirim${showNotice ? ' acik' : ''}`} role="status" aria-live="polite" aria-atomic="true">
        <span>{notice}</span>
      </div>
    </div>
  )
}
