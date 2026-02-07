import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/apiClient.js'

export default function PublicMenuPage() {
  const { tenantSlug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState('')
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
          setError(res?.message || 'Menü bulunamadı')
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
        setActiveCategoryId(cats[0]?.id || '')
      } catch (e) {
        if (!mounted) return
        setError(e?.message || 'Menü yüklenemedi')
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

  const filteredItems = useMemo(() => {
    const query = String(q || '').trim().toLowerCase()
    const list = Array.isArray(items) ? items : []
    return list
      .filter(i => {
        if (!query) return true
        const name = String(i?.name || '').toLowerCase()
        const desc = String(i?.description || '').toLowerCase()
        return name.includes(query) || desc.includes(query)
      })
  }, [items, q])

  const visibleCategories = useMemo(() => {
    const cats = Array.isArray(categories) ? categories : []
    if (!String(q || '').trim()) return cats
    const set = new Set((Array.isArray(filteredItems) ? filteredItems : []).map(i => String(i?.categoryId || '')))
    return cats.filter(c => set.has(String(c?.id || '')))
  }, [categories, filteredItems, q])

  const itemsByCategoryId = useMemo(() => {
    const map = new Map()
    for (const i of (Array.isArray(filteredItems) ? filteredItems : [])) {
      const k = String(i?.categoryId || '').trim()
      if (!k) continue
      const prev = map.get(k)
      if (prev) prev.push(i)
      else map.set(k, [i])
    }
    return map
  }, [filteredItems])

  useEffect(() => {
    const list = Array.isArray(visibleCategories) ? visibleCategories : []
    const ids = list.map(c => String(c?.id || '')).filter(Boolean)
    if (ids.length === 0) return
    const current = String(activeCategoryId || '')
    if (!current || !ids.includes(current)) {
      setActiveCategoryId(ids[0])
    }
  }, [visibleCategories, activeCategoryId])

  useEffect(() => {
    const list = Array.isArray(visibleCategories) ? visibleCategories : []
    const ids = list.map(c => String(c?.id || '')).filter(Boolean)
    if (ids.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = visible[0]?.target?.getAttribute('data-category-id')
        if (id) setActiveCategoryId(String(id))
      },
      { root: null, threshold: 0.15, rootMargin: '-120px 0px -70% 0px' }
    )

    for (const id of ids) {
      const el = sectionRefs.current?.[id]
      if (el) obs.observe(el)
    }

    return () => {
      try { obs.disconnect() } catch {}
    }
  }, [visibleCategories])

  const scrollToCategory = (id) => {
    const key = String(id || '').trim()
    if (!key) return
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
      <div className="main qr-menu" style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
        <div className="card">Yükleniyor…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="main qr-menu" style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Menü açılamadı</div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>{error}</div>
        </div>
        <div style={{ marginTop: 10 }}>
          <Link to="/login" className="btn">Giriş</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="main qr-menu" style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div className="qr-header">
        {!!logoSrc && (
          <img
            className="qr-logo"
            src={logoSrc}
            alt="Logo"
            width={112}
            height={112}
            loading="eager"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <h1 className="qr-title">{tenant?.name || 'Menü'}</h1>
        <p className="qr-subtitle">Hoşgeldiniz</p>
        <div className="qr-search">
          <input className="input" placeholder="Ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="category-bar">
        <div className="category-bar-inner">
          {visibleCategories.map(c => {
            const id = String(c?.id || '').trim()
            const active = id && String(activeCategoryId) === id
            return (
              <button
                key={id}
                type="button"
                className={`category-pill${active ? ' is-active' : ''}`}
                onClick={() => scrollToCategory(id)}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="menu-content">
        {visibleCategories.map(c => {
          const id = String(c?.id || '').trim()
          const list = itemsByCategoryId.get(id) || []
          if (!id) return null
          return (
            <section
              key={id}
              className="menu-section"
              data-category-id={id}
              ref={(el) => {
                if (!el) delete sectionRefs.current[id]
                else sectionRefs.current[id] = el
              }}
            >
              <h2 className="menu-section-title">{c.name}</h2>
              <div className="menu-rows">
                {list.map(i => (
                  <button
                    key={i.id}
                    type="button"
                    className="menu-row"
                    onClick={() => setDetail(i)}
                  >
                    {String(i?.imageUrl || '').trim() ? (
                      <img
                        className="menu-row-img"
                        src={i.imageUrl}
                        alt={i.name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className="menu-row-img menu-row-img-placeholder" aria-hidden="true" />
                    )}
                    <div className="menu-row-content">
                      <div className="menu-row-top">
                        <div className="menu-row-name">{i.name}</div>
                        <div className="menu-row-price">{Number(i.price || 0).toFixed(2)} TL</div>
                      </div>
                      {!!String(i?.description || '').trim() && (
                        <div className="menu-row-sub">{i.description}</div>
                      )}
                    </div>
                  </button>
                ))}
                {list.length === 0 && (
                  <div className="menu-empty">Bu kategoride ürün yok</div>
                )}
              </div>
            </section>
          )
        })}

        {visibleCategories.length === 0 && (
          <div className="card" style={{ color: 'var(--muted)' }}>Ürün bulunamadı</div>
        )}
      </div>

      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 60 }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 100%)', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
              <div>
                <div className="qr-modal-name">{detail.name}</div>
                <div className="qr-modal-price">{Number(detail.price || 0).toFixed(2)} TL</div>
              </div>
              <button className="btn" onClick={() => setDetail(null)}>Kapat</button>
            </div>
            {!!detail.imageUrl && (
              <img
                src={detail.imageUrl}
                alt={detail.name}
                style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 12, background: '#f3f4f6' }}
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            {!!detail.description && (
              <div className="qr-modal-desc">{detail.description}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
