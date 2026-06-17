import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import { api } from '../lib/apiClient.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

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
  return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function ProductCard({ item, onOpen }) {
  return (
    <button type="button" className="digital-public-menu-card digital-public-menu-card--product" onClick={() => onOpen(item)}>
      {!!item.imageUrl ? (
        <ProductImage className="digital-public-menu-card-image" product={item} alt={item.name} />
      ) : (
        <div className="digital-public-menu-card-image digital-public-menu-card-image--placeholder" aria-hidden="true">🍽</div>
      )}
      <div className="digital-public-menu-card-body">
        <div className="digital-public-menu-card-top">
          <h5>{item.name}</h5>
          <span>{formatMoney(item.price)}</span>
        </div>
        <p>{item.description || 'Detaylar icin dokunun.'}</p>
        <div className="digital-public-menu-card-foot">
          <span>Detaylari gor</span>
          <span className="digital-public-menu-card-arrow" aria-hidden="true">›</span>
        </div>
      </div>
    </button>
  )
}

export default function PublicMenuPage() {
  const { tenantSlug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [detail, setDetail] = useState(null)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api(`/api/public/menu?tenantSlug=${encodeURIComponent(String(tenantSlug || '').trim())}`, {
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
  }, [tenantSlug])

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
      const matchesSearch = !normalizedSearchTerm || normalizeText(`${item?.name || ''} ${item?.description || ''} ${item?.categoryName || ''}`).includes(normalizedSearchTerm)
      if (!matchesSearch) return false
      if (selectedCategory === 'all' || selectedCategory === 'Tumu' || selectedCategory === 'Tümü') return true
      if (String(item?.categoryId || '') === String(selectedCategory)) return true
      return false
    })
  }, [products, selectedCategory, normalizedSearchTerm])

  const groupedProducts = useMemo(() => {
    const map = new Map()
    for (const product of visibleProducts) {
      const key = String(product?.categoryId || '').trim()
      if (!key) continue
      const list = map.get(key)
      if (list) list.push(product)
      else map.set(key, [product])
    }
    return map
  }, [visibleProducts])

  const categoryTabs = useMemo(() => {
    const backendCategories = (Array.isArray(categories) ? categories : []).map((category) => ({
      id: String(category?.id || category?._id || '').trim(),
      name: String(category?.name || category?.title || '').trim()
    })).filter((category) => category.id && category.name)
    return [{ id: 'all', name: 'Tumu' }, ...backendCategories]
  }, [categories])

  const visibleCategories = useMemo(() => {
    if (!normalizedSearchTerm) return categoryTabs.filter((category) => category.id !== 'all')
    const ids = new Set(visibleProducts.map((item) => String(item?.categoryId || '')).filter(Boolean))
    return categoryTabs.filter((category) => category.id !== 'all' && ids.has(String(category.id)))
  }, [categoryTabs, visibleProducts, normalizedSearchTerm])

  const featuredItem = visibleProducts[0] || products[0] || null

  useEffect(() => {
    const validIds = new Set(categoryTabs.map((category) => category.id))
    if (!validIds.has(String(selectedCategory || 'all'))) setSelectedCategory('all')
  }, [categoryTabs, selectedCategory])

  if (loading) {
    return (
      <div className="digital-public-menu-page">
        <div className="digital-public-menu-shell">
          <div className="card">Menu yukleniyor...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="digital-public-menu-page">
        <div className="digital-public-menu-shell">
          <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ fontWeight: 800, color: '#b91c1c' }}>Menu acilamadi</div>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>{error}</div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Link to="/login" className="btn">Giris</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="digital-public-menu-page" data-qr-theme={qrThemeMode}>
      <div className="digital-public-menu-shell">
        <header className="digital-public-menu-header">
          <div className="digital-public-menu-brand-copy">
            <h1 className="digital-public-menu-title">{tenant?.name || 'Test'}</h1>
          </div>

          {featuredItem ? (
            <section className="digital-public-menu-hero">
              <div className="digital-public-menu-hero-copy">
                <div className="digital-public-menu-hero-pill">Bugunun onerisi</div>
                <h2>{featuredItem.name}</h2>
                <p>Detaylari gormek icin urune dokunun.</p>
              </div>
              <button type="button" className="digital-public-menu-hero-thumb" onClick={() => setDetail(featuredItem)}>
                {!!featuredItem.imageUrl ? (
                  <ProductImage product={featuredItem} alt={featuredItem.name} />
                ) : (
                  <div className="digital-public-menu-hero-placeholder" aria-hidden="true">🍽</div>
                )}
              </button>
            </section>
          ) : null}

          <label className="digital-public-menu-search">
            <span className="digital-public-menu-search-icon" aria-hidden="true">⌕</span>
            <input
              className="digital-public-menu-search-input"
              placeholder="Urun, kategori veya aciklama ara..."
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

        <main className="digital-public-menu-content">
          <div className="digital-public-menu-content-head">
            <div>
              <h3>{selectedCategory === 'all' ? 'Tumu' : categoryTabs.find((category) => String(category.id) === String(selectedCategory))?.name || 'Menu'}</h3>
              <p>{visibleProducts.length} urun listeleniyor</p>
            </div>
            <div className="digital-public-menu-mode-pill">{qrThemeMode === 'dark' ? 'Dark menu' : 'Beyaz menu'}</div>
          </div>

          {visibleProducts.length > 0 ? (
            selectedCategory === 'all' ? (
              <div className="digital-public-menu-sections">
                {visibleCategories.map((category) => {
                  const categoryId = String(category.id)
                  const categoryItems = groupedProducts.get(categoryId) || []
                  if (categoryItems.length === 0) return null
                  return (
                    <section key={categoryId} className="digital-public-menu-section">
                      <div className="digital-public-menu-section-head">
                        <h4>{category.name}</h4>
                        <span>{categoryItems.length} urun</span>
                      </div>
                      <div className="digital-public-menu-grid">
                        {categoryItems.map((item) => (
                          <ProductCard key={item.id} item={item} onOpen={setDetail} />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="digital-public-menu-grid">
                {visibleProducts.map((item) => (
                  <ProductCard key={item.id} item={item} onOpen={setDetail} />
                ))}
              </div>
            )
          ) : (
            <div className="digital-public-menu-empty">
              <h4>{normalizedSearchTerm ? 'Sonuc bulunamadi' : 'Bu kategoride urun yok'}</h4>
              <p>{normalizedSearchTerm ? 'Arama ifadesini degistirip yeniden deneyin.' : 'Farkli bir kategori secip tekrar deneyin.'}</p>
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
              <button type="button" className="digital-public-menu-modal-close" onClick={() => setDetail(null)}>×</button>
            </div>

            <div className="digital-public-menu-modal-body">
              <div className="digital-public-menu-modal-head">
                <div>
                  <h3>{detail.name}</h3>
                  <p>{detail.description || 'Bu urun icin ek aciklama bulunmuyor.'}</p>
                </div>
                <div className="digital-public-menu-modal-price">{formatMoney(detail.price)}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
