import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/apiClient.js'

function formatMoney(value) {
  const amount = Number(value || 0)
  return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildInfoTags(item, categoryName) {
  const tags = []
  if (categoryName) tags.push(categoryName)
  if (item?.isPopular) tags.push('Populer')
  if (item?.isFeatured) tags.push('Onerilen')
  if (item?.stockTracked) tags.push('Stok takipli')
  if (Number(item?.price || 0) > 0) tags.push(formatMoney(item.price))
  return tags.slice(0, 4)
}

export default function PublicMenuPage() {
  const { tenantSlug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState('all')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const sectionRefs = useRef({})

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api(`/api/public/menu?tenantSlug=${encodeURIComponent(String(tenantSlug || '').trim())}`, { silent: true, skipBranchHeader: true })
        if (!mounted) return
        if (res?.success === false) {
          setError(res?.message || 'Menu bulunamadi')
          setTenant(null)
          setCategories([])
          setItems([])
          return
        }
        const cats = Array.isArray(res?.categories) ? res.categories : []
        const its = Array.isArray(res?.items) ? res.items : []
        setTenant(res?.tenant || null)
        setCategories(cats)
        setItems(its)
        setActiveCategoryId('all')
      } catch (e) {
        if (!mounted) return
        setError(e?.message || 'Menu yuklenemedi')
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

  const apiOrigin = useMemo(() => {
    const fallback = '/api'
    try {
      const u = new URL(import.meta.env.VITE_API_URL || fallback)
      u.port = '4000'
      return u.origin
    } catch {
      return fallback
    }
  }, [])

  const logoSrc = useMemo(() => {
    const raw = String(tenant?.logoUrl || '').trim()
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    return `${apiOrigin}${raw.startsWith('/') ? '' : '/'}${raw}`
  }, [tenant?.logoUrl, apiOrigin])

  const normalizedQuery = String(q || '').trim().toLocaleLowerCase('tr-TR')

  const filteredItems = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    return list.filter((item) => {
      if (!normalizedQuery) return true
      const categoryName = String(categories.find((category) => String(category?.id) === String(item?.categoryId))?.name || '')
      const haystack = `${item?.name || ''} ${item?.description || ''} ${categoryName}`.toLocaleLowerCase('tr-TR')
      return haystack.includes(normalizedQuery)
    })
  }, [items, categories, normalizedQuery])

  const visibleCategories = useMemo(() => {
    const matchedIds = new Set(filteredItems.map((item) => String(item?.categoryId || '')))
    return categories.filter((category) => matchedIds.has(String(category?.id || '')))
  }, [categories, filteredItems])

  const categoryTabs = useMemo(() => {
    return [{ id: 'all', name: 'Tumu' }, ...visibleCategories.map((category) => ({ id: String(category.id), name: category.name }))]
  }, [visibleCategories])

  const visibleProducts = useMemo(() => {
    if (activeCategoryId === 'all') return filteredItems
    return filteredItems.filter((item) => String(item?.categoryId || '') === String(activeCategoryId))
  }, [filteredItems, activeCategoryId])

  const itemsByCategoryId = useMemo(() => {
    const map = new Map()
    for (const item of filteredItems) {
      const key = String(item?.categoryId || '').trim()
      if (!key) continue
      const prev = map.get(key)
      if (prev) prev.push(item)
      else map.set(key, [item])
    }
    return map
  }, [filteredItems])

  const featuredItem = visibleProducts[0] || filteredItems[0] || items[0] || null

  useEffect(() => {
    if (activeCategoryId === 'all') return
    const exists = visibleCategories.some((category) => String(category?.id) === String(activeCategoryId))
    if (!exists) setActiveCategoryId('all')
  }, [visibleCategories, activeCategoryId])

  const scrollToCategory = (id) => {
    const key = String(id || '').trim()
    if (!key || key === 'all') {
      setActiveCategoryId('all')
      const first = visibleCategories[0]
      const firstEl = first ? sectionRefs.current?.[String(first.id)] : null
      if (firstEl) {
        try { firstEl.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch { firstEl.scrollIntoView() }
      }
      return
    }

    setActiveCategoryId(key)
    const el = sectionRefs.current?.[key]
    if (!el) return
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      el.scrollIntoView()
    }
  }

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
    <div className="digital-public-menu-page">
      <div className="digital-public-menu-shell qr-menu">
        <header className="digital-public-menu-header">
          <div className="digital-public-menu-brand-row">
            <div className="digital-public-menu-brand-copy">
              <h1 className="digital-public-menu-title">{tenant?.name || 'PenPOS Restaurant'}</h1>
            </div>
          </div>

          {featuredItem && (
            <section className="digital-public-menu-hero">
              <div className="digital-public-menu-hero-copy">
                <div className="digital-public-menu-hero-pill">Bugunun onerisi</div>
                <h2>{featuredItem.name}</h2>
                <p>Detaylari gormek icin urune dokunun.</p>
              </div>
              <button type="button" className="digital-public-menu-hero-thumb" onClick={() => setDetail(featuredItem)}>
                {!!featuredItem.imageUrl ? (
                  <img src={featuredItem.imageUrl} alt={featuredItem.name} />
                ) : (
                  <div className="digital-public-menu-hero-placeholder" aria-hidden="true">🍽️</div>
                )}
              </button>
            </section>
          )}

          <label className="digital-public-menu-search">
            <span className="digital-public-menu-search-icon" aria-hidden="true">🔍</span>
            <input
              className="digital-public-menu-search-input"
              placeholder="Urun, kategori veya aciklama ara..."
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>

          <div className="digital-public-menu-tabbar">
            {categoryTabs.map((category) => {
              const isActive = String(activeCategoryId) === String(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`digital-public-menu-tab${isActive ? ' is-active' : ''}`}
                  onClick={() => scrollToCategory(category.id)}
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
              <h3>{activeCategoryId === 'all' ? 'Tumu' : categories.find((category) => String(category.id) === String(activeCategoryId))?.name || 'Menu'}</h3>
              <p>{visibleProducts.length} urun listeleniyor</p>
            </div>
            <div className="digital-public-menu-mode-pill">Menu modu</div>
          </div>

          {activeCategoryId === 'all' ? (
            <div className="digital-public-menu-sections">
              {visibleCategories.map((category) => {
                const categoryId = String(category.id)
                const categoryItems = itemsByCategoryId.get(categoryId) || []
                return (
                  <section
                    key={categoryId}
                    className="digital-public-menu-section"
                    ref={(element) => {
                      if (!element) delete sectionRefs.current[categoryId]
                      else sectionRefs.current[categoryId] = element
                    }}
                  >
                    <div className="digital-public-menu-section-head">
                      <h4>{category.name}</h4>
                      <span>{categoryItems.length} urun</span>
                    </div>
                    <div className="digital-public-menu-grid">
                      {categoryItems.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className="digital-public-menu-card"
                          style={{ animationDelay: `${index * 40}ms` }}
                          onClick={() => setDetail(item)}
                        >
                          {!!item.imageUrl ? (
                            <img className="digital-public-menu-card-image" src={item.imageUrl} alt={item.name} />
                          ) : (
                            <div className="digital-public-menu-card-image digital-public-menu-card-image--placeholder" aria-hidden="true">🍽️</div>
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
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="digital-public-menu-grid">
              {visibleProducts.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="digital-public-menu-card"
                  style={{ animationDelay: `${index * 40}ms` }}
                  onClick={() => setDetail(item)}
                >
                  {!!item.imageUrl ? (
                    <img className="digital-public-menu-card-image" src={item.imageUrl} alt={item.name} />
                  ) : (
                    <div className="digital-public-menu-card-image digital-public-menu-card-image--placeholder" aria-hidden="true">🍽️</div>
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
              ))}
            </div>
          )}

          {visibleProducts.length === 0 && (
            <div className="digital-public-menu-empty">
              <h4>Sonuc bulunamadi</h4>
              <p>Arama ifadesini degistirip yeniden deneyin.</p>
            </div>
          )}
        </main>
      </div>

      {detail && (
        <div className="digital-public-menu-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="digital-public-menu-modal" onClick={(event) => event.stopPropagation()}>
            <div className="digital-public-menu-modal-image-wrap">
              {!!detail.imageUrl ? (
                <img className="digital-public-menu-modal-image" src={detail.imageUrl} alt={detail.name} />
              ) : (
                <div className="digital-public-menu-modal-image digital-public-menu-modal-image--placeholder" aria-hidden="true">🍽️</div>
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

              <div className="digital-public-menu-modal-info">
                <h4>Urun Bilgisi</h4>
                <div className="digital-public-menu-modal-tags">
                  {buildInfoTags(detail, categories.find((category) => String(category.id) === String(detail.categoryId))?.name).map((tag) => (
                    <span key={tag} className="digital-public-menu-modal-tag">{tag}</span>
                  ))}
                </div>
              </div>

              <button type="button" className="digital-public-menu-modal-action" onClick={() => setDetail(null)}>
                Menuyu Incelemeye Devam Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
