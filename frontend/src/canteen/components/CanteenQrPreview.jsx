import React, { useMemo, useState } from 'react'
import { resolveProductImageUrl } from '../../lib/productImage.js'

export const PRODUCT_PLACEHOLDER = '/images/no-product.svg'
export const LOGO_PLACEHOLDER = '/images/default-logo.svg'

export const qrThemes = [
  {
    id: 'light',
    name: 'Beyaz Tema',
    colors: {
      page: '#f5f5f5',
      panel: '#ffffff',
      badge: '#f3f4f6',
      badgeText: '#1f2937',
      soft: '#f3f4f6',
      softText: '#4b5563',
      logoBg: '#ffffff',
      logoText: '#111111',
      accent: '#111111',
      accentText: '#ffffff'
    }
  },
  {
    id: 'dark',
    name: 'Dark Tema',
    colors: {
      page: '#1c1c1c',
      panel: '#232323',
      badge: '#343434',
      badgeText: '#f5f5f5',
      soft: '#343434',
      softText: '#d4d4d4',
      logoBg: '#2a2a2a',
      logoText: '#f5f5f5',
      accent: '#3a3a3a',
      accentText: '#ffffff'
    }
  }
]

const formatPrice = (value) => {
  const amount = Number(value || 0)
  return `₺${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`
}

const getTheme = (themeId) => qrThemes.find((item) => item.id === themeId) || qrThemes[0]

function PreviewProductCard({ product, colors }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        borderRadius: 24,
        border: '1px solid rgba(148, 163, 184, 0.2)',
        background: '#ffffff',
        padding: 12,
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)'
      }}
    >
      <img
        src={resolveProductImageUrl({ imageUrl: product.imageUrl || PRODUCT_PLACEHOLDER })}
        onError={(event) => {
          event.currentTarget.src = PRODUCT_PLACEHOLDER
        }}
        alt={product.name}
        style={{ width: 96, height: 96, borderRadius: 18, objectFit: 'cover', flexShrink: 0, background: '#f8fafc' }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            marginBottom: 6,
            display: 'inline-flex',
            borderRadius: 999,
            padding: '4px 8px',
            background: colors.soft,
            color: colors.softText,
            fontSize: 10,
            fontWeight: 900
          }}
        >
          {product.categoryName || 'Diger Urunler'}
        </div>
        <div style={{ fontWeight: 900, lineHeight: 1.25, color: '#0f172a' }}>{product.name}</div>
        <div style={{ marginTop: 6, color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
          {String(product.description || '').trim() || 'Aciklama bulunmuyor.'}
        </div>
        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 950, color: colors.panel }}>{formatPrice(product.price)}</div>
      </div>
    </div>
  )
}

export default function CanteenQrPreview({
  title,
  description,
  logoUrl,
  themeId,
  products,
  categories,
  showPhoneFrame = true
}) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const theme = getTheme(themeId)

  const visibleProducts = useMemo(() => {
    const query = String(search || '').trim().toLowerCase()
    return (Array.isArray(products) ? products : []).filter((product) => {
      const categoryMatch = activeCategory === 'all' || String(product.categoryId || '') === activeCategory
      const searchMatch = !query || [product.name, product.description, product.categoryName].some((value) => String(value || '').toLowerCase().includes(query))
      return categoryMatch && searchMatch
    })
  }, [activeCategory, products, search])

  const frameStyle = showPhoneFrame
    ? {
        maxWidth: 390,
        margin: '0 auto',
        borderRadius: 38,
        border: '10px solid #0f172a',
        background: '#ffffff',
        padding: 12,
        boxShadow: '0 30px 80px rgba(15, 23, 42, 0.22)'
      }
    : {
        maxWidth: 880,
        margin: '0 auto'
      }

  return (
    <div style={frameStyle}>
      <div style={{ borderRadius: 28, overflow: 'hidden', background: theme.colors.page }}>
        <div style={{ background: theme.colors.panel, padding: 20, color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 24,
                background: theme.colors.logoBg,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                color: theme.colors.logoText,
                fontWeight: 950,
                fontSize: 22
              }}
            >
              <img
                src={resolveProductImageUrl({ imageUrl: logoUrl || LOGO_PLACEHOLDER })}
                onError={(event) => {
                  event.currentTarget.src = LOGO_PLACEHOLDER
                }}
                alt={title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 950, lineHeight: 1.15 }}>{title || 'QR Vitrini'}</div>
              <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 1.5 }}>
                {description || 'Güncel ürün fiyatlari burada listelenir.'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 18,
              background: '#ffffff',
              padding: '12px 14px',
              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)'
            }}
          >
            <span style={{ fontSize: 16 }}>🔎</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün ara"
              style={{ width: '100%', border: 0, outline: 0, background: 'transparent', fontWeight: 700, color: '#0f172a' }}
            />
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              style={{
                border: 0,
                borderRadius: 999,
                padding: '9px 14px',
                fontWeight: 900,
                whiteSpace: 'nowrap',
                background: activeCategory === 'all' ? theme.colors.accent : '#ffffff',
                color: activeCategory === 'all' ? theme.colors.accentText : '#334155',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)'
              }}
            >
              Tumu
            </button>
            {(Array.isArray(categories) ? categories : []).map((category) => {
              const isActive = activeCategory === String(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(String(category.id))}
                  style={{
                    border: 0,
                    borderRadius: 999,
                    padding: '9px 14px',
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    background: isActive ? theme.colors.accent : '#ffffff',
                    color: isActive ? theme.colors.accentText : '#334155',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)'
                  }}
                >
                  {category.name}
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            {visibleProducts.map((product) => (
              <PreviewProductCard key={product.id} product={product} colors={theme.colors} />
            ))}
            {visibleProducts.length === 0 ? (
              <div
                style={{
                  borderRadius: 24,
                  background: '#ffffff',
                  padding: 20,
                  textAlign: 'center',
                  color: '#64748b',
                  fontWeight: 800,
                  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)'
                }}
              >
                Bu filtre için ürün bulunamadı.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
