import React, { useEffect, useMemo, useState } from 'react'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

type Category = {
  id: string
  label: string
  icon: string
}

type Product = {
  id: number
  category: string
  name: string
  desc: string
  price: number
  badge: string
  image: string
  info: string[]
}

const categories: Category[] = [
  { id: 'all', label: 'Tumu', icon: '🍽️' },
  { id: 'popular', label: 'Populer', icon: '⭐' },
  { id: 'breakfast', label: 'Kahvalti', icon: '☕' },
  { id: 'main', label: 'Ana Yemek', icon: '🥩' },
  { id: 'pizza', label: 'Pizza', icon: '🍕' },
  { id: 'drinks', label: 'Icecek', icon: '🥤' },
  { id: 'dessert', label: 'Tatli', icon: '🍰' }
]

const products: Product[] = [
  {
    id: 1,
    category: 'popular',
    name: 'Sef Burger Menü',
    desc: 'Dana burger, cheddar, karamelize sogan, ozel sos ve citir patates.',
    price: 285,
    badge: 'Cok Satan',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=900&auto=format&fit=crop',
    info: ['Dana eti', 'Cheddar', 'Gluten içerir', 'Patates dahil']
  },
  {
    id: 2,
    category: 'popular',
    name: 'Izgara Tavuk Bowl',
    desc: 'Izgara tavuk, Akdeniz yesillikleri, pilav ve yogurtlu sos.',
    price: 235,
    badge: 'Fit',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop',
    info: ['Protein yuksek', 'Yogurt sos', 'Hafif ogun', 'Acisiz']
  },
  {
    id: 3,
    category: 'breakfast',
    name: 'Serpme Kahvalti',
    desc: 'Peynir cesitleri, zeytin, bal-kaymak, menemen ve sınırsız cay.',
    price: 420,
    badge: '2 Kişilik',
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?q=80&w=900&auto=format&fit=crop',
    info: ['2 kişilik', 'Sınırsız cay', 'Yumurta içerir', 'Süt urunu içerir']
  },
  {
    id: 4,
    category: 'main',
    name: 'Lokum Bonfile',
    desc: 'Dana bonfile, koz sebze, patates puresi ve ozel sos.',
    price: 560,
    badge: 'Premium',
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?q=80&w=900&auto=format&fit=crop',
    info: ['Dana bonfile', 'Koz sebze', 'Ozel sos', 'Porsiyon 250 gr']
  },
  {
    id: 5,
    category: 'pizza',
    name: 'Napolitan Pizza',
    desc: 'Mozzarella, domates sos, feslegen ve zeytinyagi.',
    price: 310,
    badge: 'Yeni',
    image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?q=80&w=900&auto=format&fit=crop',
    info: ['Mozzarella', 'Gluten içerir', 'Domates sos', 'Vejetaryen']
  },
  {
    id: 6,
    category: 'drinks',
    name: 'Berry Soguk Cay',
    desc: 'Orman meyveli ev yapimi soguk cay, taze nane ile.',
    price: 95,
    badge: 'Ferahlik',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=900&auto=format&fit=crop',
    info: ['Ev yapimi', 'Soguk servis', 'Meyveli', '330 ml']
  },
  {
    id: 7,
    category: 'dessert',
    name: 'San Sebastian',
    desc: 'Kremamsi cheesecake, cikolata sosu ve mevsim meyvesi.',
    price: 175,
    badge: 'Favori',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?q=80&w=900&auto=format&fit=crop',
    info: ['Süt urunu içerir', 'Yumurta içerir', 'Cikolata sos', 'Günlük hazirlanir']
  }
]

function money(value: number) {
  return `₺${value.toLocaleString('tr-TR')}`
}

export default function DigitalMenuPage() {
  const [active, setActive] = useState<string>('all')
  const [query, setQuery] = useState<string>('')
  const [selected, setSelected] = useState<Product | null>(null)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS | Dijital Menü'
  }, [])

  useEffect(() => {
    document.body.classList.toggle('modal-open', !!selected)
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [selected])

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
    return products.filter((product) => {
      const matchesCategory = active === 'all' || product.category === active
      const matchesQuery = `${product.name} ${product.desc}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [active, query])

  const activeLabel = categories.find((category) => category.id === active)?.label || 'Menü'

  return (
    <div className="digital-menü-page">
      <div className="digital-menü-shell">
        <header className="digital-menü-header">
          <div className="digital-menü-brand-row">
            <div>
              <div className="digital-menü-kicker">QR Dijital Menü</div>
              <h1 className="digital-menü-title">PenPOS Restaurant</h1>
              <p className="digital-menü-subtitle">QR kodu okutarak menuyu inceleyin.</p>
            </div>
            <div className="digital-menü-qr-badge">
              <span>ORTAK</span>
              <strong>QR</strong>
            </div>
          </div>

          <section className="digital-menü-hero">
            <div className="digital-menü-hero-copy">
              <span className="digital-menü-hero-pill">Bugunun onerisi</span>
              <h2>Sef Burger Menü</h2>
              <p>Detaylari görmek için urune dokunun.</p>
            </div>
            <div className="digital-menü-hero-image-wrap">
              <img src={products[0].image} alt="Sef Burger Menü" className="digital-menü-hero-image" />
            </div>
          </section>

          <label className="digital-menü-search">
            <span className="digital-menü-search-icon" aria-hidden="true">🔍</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ürün, kategori veya aciklama ara..."
              className="digital-menü-search-input"
            />
          </label>

          <div className="digital-menü-categories" aria-label="Menü kategorileri">
            {categories.map((category) => {
              const isActive = active === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActive(category.id)}
                  className={`digital-menü-category-pill${isActive ? ' is-active' : ''}`}
                >
                  <span aria-hidden="true">{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              )
            })}
          </div>
        </header>

        <main className="digital-menü-content">
          <div className="digital-menü-content-head">
            <div>
              <h3>{activeLabel}</h3>
              <p>{visibleProducts.length} urun listeleniyor</p>
            </div>
            <div className="digital-menü-mode-pill">Menü modu</div>
          </div>

          <div className="digital-menü-grid">
            {visibleProducts.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelected(product)}
                className="digital-menü-card"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="digital-menü-card-image-wrap">
                  <img src={product.image} alt={product.name} className="digital-menü-card-image" />
                  <span className="digital-menü-card-badge">{product.badge}</span>
                </div>
                <div className="digital-menü-card-body">
                  <div className="digital-menü-card-top">
                    <h4>{product.name}</h4>
                    <span className="digital-menü-price">{money(product.price)}</span>
                  </div>
                  <p className="digital-menü-card-desc">{product.desc}</p>
                  <div className="digital-menü-card-foot">
                    <span>Detaylari gor</span>
                    <span className="digital-menü-card-arrow" aria-hidden="true">›</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {visibleProducts.length === 0 && (
            <div className="digital-menü-empty">
              <h4>Sonuç bulunamadı</h4>
              <p>Arama kelimesini veya kategori secimini degistirerek menuyu tekrar inceleyin.</p>
            </div>
          )}
        </main>
      </div>

      {selected && (
        <div
          className="digital-menü-modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div className="digital-menü-modal" onClick={(event) => event.stopPropagation()}>
            <div className="digital-menü-modal-image-wrap">
              <img src={selected.image} alt={selected.name} className="digital-menü-modal-image" />
              <button type="button" onClick={() => setSelected(null)} className="digital-menü-modal-close">
                ×
              </button>
              <div className="digital-menü-modal-badge">{selected.badge}</div>
            </div>

            <div className="digital-menü-modal-body">
              <div className="digital-menü-modal-head">
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.desc}</p>
                </div>
                <div className="digital-menü-modal-price">{money(selected.price)}</div>
              </div>

              <section className="digital-menü-modal-info">
                <h4>Ürün Bilgisi</h4>
                <div className="digital-menü-modal-tags">
                  {selected.info.map((item) => (
                    <span key={item} className="digital-menü-modal-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </section>

              <button type="button" onClick={() => setSelected(null)} className="digital-menü-modal-action">
                Menuyu Incelemeye Devam Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
