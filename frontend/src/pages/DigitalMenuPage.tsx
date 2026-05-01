import React, { useEffect, useMemo, useState } from 'react'

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
    name: 'Sef Burger Menu',
    desc: 'Dana burger, cheddar, karamelize sogan, ozel sos ve citir patates.',
    price: 285,
    badge: 'Cok Satan',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=900&auto=format&fit=crop',
    info: ['Dana eti', 'Cheddar', 'Gluten icerir', 'Patates dahil']
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
    desc: 'Peynir cesitleri, zeytin, bal-kaymak, menemen ve sinirsiz cay.',
    price: 420,
    badge: '2 Kisilik',
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?q=80&w=900&auto=format&fit=crop',
    info: ['2 kisilik', 'Sinirsiz cay', 'Yumurta icerir', 'Sut urunu icerir']
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
    info: ['Mozzarella', 'Gluten icerir', 'Domates sos', 'Vejetaryen']
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
    info: ['Sut urunu icerir', 'Yumurta icerir', 'Cikolata sos', 'Gunluk hazirlanir']
  }
]

function money(value: number) {
  return `₺${value.toLocaleString('tr-TR')}`
}

export default function DigitalMenuPage() {
  const [active, setActive] = useState<string>('all')
  const [query, setQuery] = useState<string>('')
  const [selected, setSelected] = useState<Product | null>(null)

  useEffect(() => {
    document.title = 'PenPOS | Dijital Menu'
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

  const activeLabel = categories.find((category) => category.id === active)?.label || 'Menu'

  return (
    <div className="digital-menu-page">
      <div className="digital-menu-shell">
        <header className="digital-menu-header">
          <div className="digital-menu-brand-row">
            <div>
              <div className="digital-menu-kicker">QR Dijital Menu</div>
              <h1 className="digital-menu-title">PenPOS Restaurant</h1>
              <p className="digital-menu-subtitle">QR kodu okutarak menuyu inceleyin.</p>
            </div>
            <div className="digital-menu-qr-badge">
              <span>ORTAK</span>
              <strong>QR</strong>
            </div>
          </div>

          <section className="digital-menu-hero">
            <div className="digital-menu-hero-copy">
              <span className="digital-menu-hero-pill">Bugunun onerisi</span>
              <h2>Sef Burger Menu</h2>
              <p>Detaylari gormek icin urune dokunun.</p>
            </div>
            <div className="digital-menu-hero-image-wrap">
              <img src={products[0].image} alt="Sef Burger Menu" className="digital-menu-hero-image" />
            </div>
          </section>

          <label className="digital-menu-search">
            <span className="digital-menu-search-icon" aria-hidden="true">🔍</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Urun, kategori veya aciklama ara..."
              className="digital-menu-search-input"
            />
          </label>

          <div className="digital-menu-categories" aria-label="Menu kategorileri">
            {categories.map((category) => {
              const isActive = active === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActive(category.id)}
                  className={`digital-menu-category-pill${isActive ? ' is-active' : ''}`}
                >
                  <span aria-hidden="true">{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              )
            })}
          </div>
        </header>

        <main className="digital-menu-content">
          <div className="digital-menu-content-head">
            <div>
              <h3>{activeLabel}</h3>
              <p>{visibleProducts.length} urun listeleniyor</p>
            </div>
            <div className="digital-menu-mode-pill">Menu modu</div>
          </div>

          <div className="digital-menu-grid">
            {visibleProducts.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelected(product)}
                className="digital-menu-card"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="digital-menu-card-image-wrap">
                  <img src={product.image} alt={product.name} className="digital-menu-card-image" />
                  <span className="digital-menu-card-badge">{product.badge}</span>
                </div>
                <div className="digital-menu-card-body">
                  <div className="digital-menu-card-top">
                    <h4>{product.name}</h4>
                    <span className="digital-menu-price">{money(product.price)}</span>
                  </div>
                  <p className="digital-menu-card-desc">{product.desc}</p>
                  <div className="digital-menu-card-foot">
                    <span>Detaylari gor</span>
                    <span className="digital-menu-card-arrow" aria-hidden="true">›</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {visibleProducts.length === 0 && (
            <div className="digital-menu-empty">
              <h4>Sonuc bulunamadi</h4>
              <p>Arama kelimesini veya kategori secimini degistirerek menuyu tekrar inceleyin.</p>
            </div>
          )}
        </main>
      </div>

      {selected && (
        <div
          className="digital-menu-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div className="digital-menu-modal" onClick={(event) => event.stopPropagation()}>
            <div className="digital-menu-modal-image-wrap">
              <img src={selected.image} alt={selected.name} className="digital-menu-modal-image" />
              <button type="button" onClick={() => setSelected(null)} className="digital-menu-modal-close">
                ×
              </button>
              <div className="digital-menu-modal-badge">{selected.badge}</div>
            </div>

            <div className="digital-menu-modal-body">
              <div className="digital-menu-modal-head">
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.desc}</p>
                </div>
                <div className="digital-menu-modal-price">{money(selected.price)}</div>
              </div>

              <section className="digital-menu-modal-info">
                <h4>Urun Bilgisi</h4>
                <div className="digital-menu-modal-tags">
                  {selected.info.map((item) => (
                    <span key={item} className="digital-menu-modal-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </section>

              <button type="button" onClick={() => setSelected(null)} className="digital-menu-modal-action">
                Menuyu Incelemeye Devam Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
