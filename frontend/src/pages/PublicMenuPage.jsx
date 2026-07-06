import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

const translations = {
  tr: {
    menuLoading: 'Menu yukleniyor...',
    menuOpenError: 'Menu acilamadi',
    login: 'Giris',
    qrMenu: 'QR Menu',
    featured: 'Bugunun onerisi',
    tapForDetails: 'Detaylari gormek icin urune dokunun.',
    searchPlaceholder: 'Urun, kategori veya aciklama ara...',
    all: 'Tumu',
    menu: 'Menu',
    itemCount: (count) => `${count} urun listeleniyor`,
    itemShortCount: (count) => `${count} urun`,
    lightMenu: 'Beyaz menu',
    darkMenu: 'Dark menu',
    noResult: 'Sonuc bulunamadi',
    noItems: 'Bu kategoride urun yok',
    retrySearch: 'Arama ifadesini degistirip yeniden deneyin.',
    retryCategory: 'Farkli bir kategori secip tekrar deneyin.',
    details: 'Detaylari gor',
    noDescription: 'Bu urun icin ek aciklama bulunmuyor.',
    noItemDescription: 'Detaylar icin dokunun.',
    languageTr: 'TR',
    languageEn: 'EN',
    table: 'Masa',
    qrModeTable: 'Masa QR aktif',
    qrModePublic: 'Genel QR',
    waiterCall: 'Garson cagir',
    waiterCallSending: 'Gonderiliyor...',
    waiterCallSuccess: 'Garson cagrisi iletildi',
  },
  en: {
    menuLoading: 'Loading menu...',
    menuOpenError: 'Menu could not be opened',
    login: 'Login',
    qrMenu: 'QR Menu',
    featured: 'Featured today',
    tapForDetails: 'Tap the item to view details.',
    searchPlaceholder: 'Search products, categories or descriptions...',
    all: 'All',
    menu: 'Menu',
    itemCount: (count) => `${count} items listed`,
    itemShortCount: (count) => `${count} items`,
    lightMenu: 'Light menu',
    darkMenu: 'Dark menu',
    noResult: 'No results found',
    noItems: 'No items in this category',
    retrySearch: 'Change the search phrase and try again.',
    retryCategory: 'Choose a different category and try again.',
    details: 'View details',
    noDescription: 'No additional description is available for this item.',
    noItemDescription: 'Tap for details.',
    languageTr: 'TR',
    languageEn: 'EN',
    table: 'Table',
    qrModeTable: 'Table QR active',
    qrModePublic: 'Public QR',
    waiterCall: 'Call waiter',
    waiterCallSending: 'Sending...',
    waiterCallSuccess: 'Waiter call sent',
  },
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .toLocaleLowerCase('tr-TR')
    .trim()
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return `\u20BA${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isVisibleItem(item) {
  if (!item || typeof item !== 'object') return false
  if (item.isActive === false) return false
  if (item.isDeleted === true) return false
  if (item.deletedAt) return false
  return true
}

function buildCategoryMap(categories) {
  const map = new Map()
  for (const category of (Array.isArray(categories) ? categories : [])) {
    const id = String(category?.id || category?._id || '').trim()
    const name = String(category?.name || category?.title || '').trim()
    if (id) map.set(id, { ...category, id, name })
  }
  return map
}

function ProductCard({ item, onOpen, showPrices, showDescriptions, labels }) {
  return (
    <button type="button" className="digital-public-menu-card digital-public-menu-card--product" onClick={() => onOpen(item)}>
      {!!item.imageUrl ? (
        <ProductImage className="digital-public-menu-card-image" product={item} alt={item.name} />
      ) : (
        <div className="digital-public-menu-card-image digital-public-menu-card-image--placeholder" aria-hidden="true">{'\u{1F37D}'}</div>
      )}
      <div className="digital-public-menu-card-body">
        <div className="digital-public-menu-card-top">
          <h5>{item.name}</h5>
          {showPrices ? <span>{formatMoney(item.price)}</span> : null}
        </div>
        {showDescriptions ? <p>{item.description || labels.noItemDescription}</p> : null}
        <div className="digital-public-menu-card-foot">
          <span>{labels.details}</span>
          <span className="digital-public-menu-card-arrow" aria-hidden="true">{'\u203A'}</span>
        </div>
      </div>
    </button>
  )
}

export default function PublicMenuPage() {
  const { tenantSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [detail, setDetail] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [availableTables, setAvailableTables] = useState([])
  const [waiterCalling, setWaiterCalling] = useState(false)
  const [language, setLanguage] = useState('tr')
  const [tablePickerOpen, setTablePickerOpen] = useState(false)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const search = new URLSearchParams(location.search || '')
        const tableId = String(search.get('tableId') || '').trim()
        const tableName = String(search.get('table') || search.get('tableName') || '').trim()
        const query = new URLSearchParams({ tenantSlug: String(tenantSlug || '').trim() })
        if (tableId) query.set('tableId', tableId)
        if (tableName) query.set('table', tableName)
        const res = await api(`/api/public/menu?${query.toString()}`, {
          silent: true,
          skipBranchHeader: true
        })
        if (!mounted) return
        if (res?.success === false) {
          setError(res?.message || 'Menu bulunamadi')
          setTenant(null)
          setCategories([])
          setItems([])
          return
        }
        setTenant(res?.tenant || null)
        setCategories(Array.isArray(res?.categories) ? res.categories : [])
        setItems(Array.isArray(res?.items) ? res.items : [])
        setSelectedTable(res?.table || null)
        setAvailableTables(Array.isArray(res?.availableTables) ? res.availableTables : [])
        setSelectedCategory('all')
      } catch (err) {
        if (!mounted) return
        setError(err?.message || 'Menu yuklenemedi')
        setTenant(null)
        setCategories([])
        setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [tenantSlug, location.search])

  useEffect(() => {
    document.title = tenant?.name ? `${tenant.name} | Dijital Menu` : 'PenPOS | Dijital Menu'
  }, [tenant?.name])

  useEffect(() => {
    document.body.classList.toggle('modal-open', !!detail)
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [detail])

  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories])
  const qrMenuSettings = tenant?.settings?.qrMenu || {}
  const qrThemeMode = qrMenuSettings?.themeMode === 'dark' ? 'dark' : 'light'
  const showLogo = qrMenuSettings?.showLogo !== false
  const showCoverImage = qrMenuSettings?.showCoverImage !== false
  const showPrices = qrMenuSettings?.showPrices !== false
  const showDescriptions = qrMenuSettings?.showDescriptions !== false
  const waiterCallEnabled = qrMenuSettings?.waiterCall === true
  const multiLanguageEnabled = qrMenuSettings?.multiLanguage === true
  const tableQrEnabled = qrMenuSettings?.tableQrEnabled === true
  const tenantLogoUrl = String(tenant?.logoUrl || '').trim()
  const labels = translations[language] || translations.tr

  const products = useMemo(() => {
    return (Array.isArray(items) ? items : [])
      .filter(isVisibleItem)
      .map((item, index) => {
        const rawCategoryId = String(item?.categoryId || '').trim()
        const category = categoryMap.get(rawCategoryId)
        return {
          ...item,
          id: String(item?.id || item?._id || `${rawCategoryId || 'product'}-${index}`),
          categoryId: rawCategoryId,
          categoryName: String(item?.categoryName || category?.name || item?.category || '').trim()
        }
      })
  }, [items, categoryMap])

  const normalizedSearchTerm = useMemo(() => normalizeText(searchTerm), [searchTerm])

  const visibleProducts = useMemo(() => {
    return products.filter((item) => {
      const haystack = `${item?.name || ''} ${item?.description || ''} ${item?.categoryName || ''}`
      const matchesSearch = !normalizedSearchTerm || normalizeText(haystack).includes(normalizedSearchTerm)
      if (!matchesSearch) return false
      if (selectedCategory === 'all' || selectedCategory === 'Tumu' || selectedCategory === 'Tümü') return true
      if (String(item?.categoryId || '') === String(selectedCategory)) return true
      return false
    })
  }, [products, selectedCategory, normalizedSearchTerm])

  const categoryTabs = useMemo(() => {
    const backendCategories = (Array.isArray(categories) ? categories : []).map((category) => ({
      id: String(category?.id || category?._id || '').trim(),
      name: String(category?.name || category?.title || '').trim()
    })).filter((category) => category.id && category.name)
    return [{ id: 'all', name: labels.all }, ...backendCategories]
  }, [categories, labels.all])

  const featuredItem = useMemo(() => {
    const selectedFeaturedId = String(qrMenuSettings?.featuredProductId || '').trim()
    if (selectedFeaturedId) {
      const matched = products.find((item) => String(item?.id || '') === selectedFeaturedId)
      if (matched) return matched
    }
    return products[0] || null
  }, [products, qrMenuSettings?.featuredProductId])

  useEffect(() => {
    const validIds = new Set(categoryTabs.map((category) => category.id))
    if (!validIds.has(String(selectedCategory || 'all'))) setSelectedCategory('all')
  }, [categoryTabs, selectedCategory])

  const callWaiter = async () => {
    if (!tenantSlug || !waiterCallEnabled || waiterCalling) return
    if (tableQrEnabled && !selectedTable?.id) {
      toast.error('Önce masa seçin')
      return
    }
    setWaiterCalling(true)
    try {
      const res = await api('/api/public/menu/waiter-call', {
        method: 'POST',
        body: JSON.stringify({
          tenantSlug,
          tableId: selectedTable?.id || '',
          tableName: selectedTable?.name || '',
        }),
        silent: true,
        skipBranchHeader: true,
      })
      if (res?.success === false) {
        toast.error(res?.message || labels.waiterCallSuccess)
        return
      }
      toast.success(res?.message || labels.waiterCallSuccess)
    } catch (err) {
      toast.error(err?.message || 'Islem basarisiz')
    } finally {
      setWaiterCalling(false)
    }
  }

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'tr' ? 'en' : 'tr'))
  }

  const selectTable = (table) => {
    const params = new URLSearchParams(location.search || '')
    if (table?.id) {
      params.set('tableId', String(table.id))
      params.set('table', String(table.name || ''))
    } else {
      params.delete('tableId')
      params.delete('table')
      params.delete('tableName')
    }
    setTablePickerOpen(false)
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true })
  }

  if (loading) {
    return (
      <div className="digital-public-menu-page">
        <div className="digital-public-menu-shell">
          <div className="card">{labels.menuLoading}</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="digital-public-menu-page">
        <div className="digital-public-menu-shell">
          <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ fontWeight: 800, color: '#b91c1c' }}>{labels.menuOpenError}</div>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>{error}</div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Link to="/login" className="btn">{labels.login}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="digital-public-menu-page" data-qr-theme={qrThemeMode}>
      <div className="digital-public-menu-shell digital-public-menu-shell--compact">
        <header className="digital-public-menu-header digital-public-menu-header--compact">
          <div className="digital-public-menu-brand-row">
            <div className="digital-public-menu-brand-copy">
              <div className="digital-public-menu-kicker">{labels.qrMenu}</div>
              <h1 className="digital-public-menu-title">{tenant?.name || 'Test'}</h1>
            </div>
          </div>

          {(showLogo || (showCoverImage && featuredItem)) ? (
            <div className="digital-public-menu-spotlight-row">
              {showLogo ? (
                <div className="digital-public-menu-badge-wrap">
                  {tenantLogoUrl ? (
                    <img className="digital-public-menu-logo" src={tenantLogoUrl} alt={`${tenant?.name || 'Isletme'} logosu`} />
                  ) : (
                    <div className="digital-public-menu-logo digital-public-menu-logo--placeholder" aria-hidden="true">
                      {String(tenant?.name || 'QR').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              ) : null}

              {showCoverImage && featuredItem ? (
                <section className="digital-public-menu-hero">
                  <div className="digital-public-menu-hero-copy">
                    <div className="digital-public-menu-hero-pill">{labels.featured}</div>
                    <h2>{featuredItem.name}</h2>
                    <p>{showDescriptions ? (featuredItem.description || labels.tapForDetails) : labels.tapForDetails}</p>
                  </div>
                  <button type="button" className="digital-public-menu-hero-thumb" onClick={() => setDetail(featuredItem)}>
                    {!!featuredItem.imageUrl ? (
                      <ProductImage product={featuredItem} alt={featuredItem.name} />
                    ) : (
                      <div className="digital-public-menu-hero-placeholder" aria-hidden="true">{'\u{1F37D}'}</div>
                    )}
                  </button>
                </section>
              ) : null}
            </div>
          ) : null}

          {(tableQrEnabled || multiLanguageEnabled || waiterCallEnabled) ? (
            <div className="digital-public-menu-meta-row">
              <div className="digital-public-menu-meta-pills">
                {tableQrEnabled ? (
                  <>
                    <div className="digital-public-menu-info-pill">
                      <strong>{labels.table}</strong>
                      <span>{selectedTable?.name || '-'}</span>
                    </div>
                    <button type="button" className="digital-public-menu-secondary-btn digital-public-menu-secondary-btn--compact" onClick={() => setTablePickerOpen((prev) => !prev)}>
                      Masa Seç
                    </button>
                  </>
                ) : null}
              </div>
              <div className="digital-public-menu-meta-actions">
                {multiLanguageEnabled ? (
                  <button type="button" className="digital-public-menu-secondary-btn digital-public-menu-secondary-btn--compact digital-public-menu-language-toggle" onClick={toggleLanguage}>
                    {language === 'tr' ? labels.languageTr : labels.languageEn}
                  </button>
                ) : null}
                {waiterCallEnabled ? (
                  <button type="button" className="digital-public-menu-secondary-btn digital-public-menu-secondary-btn--compact" onClick={callWaiter} disabled={waiterCalling || (tableQrEnabled && !selectedTable?.id)}>
                    {waiterCalling ? labels.waiterCallSending : labels.waiterCall}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {tableQrEnabled && tablePickerOpen ? (
            <div className="digital-public-menu-meta-row" style={{ marginTop: 10 }}>
              <div className="digital-public-menu-meta-pills" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="digital-public-menu-secondary-btn digital-public-menu-secondary-btn--compact" onClick={() => selectTable(null)}>
                  Genel QR
                </button>
                {availableTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    className={`digital-public-menu-secondary-btn digital-public-menu-secondary-btn--compact${selectedTable?.id === table.id ? ' is-active' : ''}`}
                    onClick={() => selectTable(table)}
                  >
                    {table.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="digital-public-menu-search">
            <span className="digital-public-menu-search-icon" aria-hidden="true">{'\u2315'}</span>
            <input
              className="digital-public-menu-search-input"
              placeholder={labels.searchPlaceholder}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value || '')}
            />
          </label>

          <div className="digital-public-menu-tabbar">
            {categoryTabs.map((category) => {
              const isActive = String(selectedCategory) === String(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`digital-public-menu-tab${isActive ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </button>
              )
            })}
          </div>
        </header>

        <main className="digital-public-menu-content digital-public-menu-content--full">
          {visibleProducts.length > 0 ? (
            <div className="digital-public-menu-grid">
              {visibleProducts.map((item) => (
                <ProductCard key={item.id} item={item} onOpen={setDetail} showPrices={showPrices} showDescriptions={showDescriptions} labels={labels} />
              ))}
            </div>
          ) : (
            <div className="digital-public-menu-empty">
              <h4>{normalizedSearchTerm ? labels.noResult : labels.noItems}</h4>
              <p>{normalizedSearchTerm ? labels.retrySearch : labels.retryCategory}</p>
            </div>
          )}
        </main>
      </div>

      {detail ? (
        <div className="digital-public-menu-modal-backdrop" role="dialog" aria-modal="true">
          <div className="digital-public-menu-modal" onClick={(event) => event.stopPropagation()}>
            <div className="digital-public-menu-modal-image-wrap">
              {!!detail.imageUrl ? (
                <ProductImage className="digital-public-menu-modal-image" product={detail} alt={detail.name} />
              ) : (
                <div className="digital-public-menu-modal-image digital-public-menu-modal-image--placeholder" aria-hidden="true">IMG</div>
              )}
              <button type="button" className="digital-public-menu-modal-close" onClick={() => setDetail(null)}>{'\u00D7'}</button>
            </div>

            <div className="digital-public-menu-modal-body">
              <div className="digital-public-menu-modal-head">
                <div>
                  <h3>{detail.name}</h3>
                  {showDescriptions ? <p>{detail.description || labels.noDescription}</p> : null}
                </div>
                {showPrices ? <div className="digital-public-menu-modal-price">{formatMoney(detail.price)}</div> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
