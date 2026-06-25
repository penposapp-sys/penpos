import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { api } from '../lib/apiClient.js'
import { defaultWebsiteSettings } from '../constants/websiteSettings.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

const tabs = [
  { key: 'restaurant', label: 'Restoran', icon: 'store' },
  { key: 'canteen', label: 'Mağaza', icon: 'cart' },
  { key: 'qr', label: 'QR Menü', icon: 'card' },
  { key: 'reports', label: 'Raporlar', icon: 'chart' }
]

const previewContent = {
  restaurant: {
    title: 'Restoran / Cafe Sistemi',
    subtitle: 'Masa, adisyon, mutfak, paket servis ve QR menü tek akışta.',
    statA: '₺42.850',
    statB: '128',
    badge: 'Masa + mutfak'
  },
  canteen: {
    title: 'Mağaza / Market Sistemi',
    subtitle: 'Barkodlu hızlı satış, ürün fiyat listesi ve telefonla satışa uygun yapı.',
    statA: '₺8.740',
    statB: '342',
    badge: 'Barkod + hızlı satış'
  },
  qr: {
    title: 'Entegre QR Menü',
    subtitle: 'QR menü ekstra değil, sistemin standart parçası olarak çalışır.',
    statA: 'QR',
    statB: '7/24',
    badge: 'Sisteme dahil'
  },
  reports: {
    title: 'Canlı Raporlar',
    subtitle: 'Z raporu, ödeme tipleri, şube performansı ve günlük satış özetleri.',
    statA: '₺1.250',
    statB: '4 Şube',
    badge: 'Anlık kontrol'
  }
}

function Icon({ name, className = '' }) {
  const base = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'arrow') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M10 7h7v7" {...base} /></svg>
  if (name === 'play') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" {...base} /></svg>
  if (name === 'chevron') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" {...base} /></svg>
  if (name === 'menu') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" {...base} /></svg>
  if (name === 'x') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" {...base} /></svg>
  if (name === 'card') return <svg className={className} viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="3" {...base} /><path d="M3 10h18" {...base} /></svg>
  if (name === 'cart') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M5 5h2l2 10h9l2-7H8" {...base} /><circle cx="10" cy="20" r="1.4" fill="currentColor" /><circle cx="18" cy="20" r="1.4" fill="currentColor" /></svg>
  if (name === 'box') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4z" {...base} /><path d="M4 8v8l8 4 8-4V8" {...base} /><path d="M12 12v8" {...base} /></svg>
  if (name === 'chart') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M5 19V9M12 19V5M19 19v-7" {...base} /></svg>
  if (name === 'check') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" {...base} /></svg>
  if (name === 'store') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M4 10h16l-1.5-5h-13L4 10zM6 10v9h12v-9M9 19v-5h6v5" {...base} /></svg>
  if (name === 'whatsapp') return <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M12 3.2a8.8 8.8 0 0 0-7.5 13.5L3.4 21l4.5-1.2A8.8 8.8 0 1 0 12 3.2z" fill="currentColor" fillOpacity=".16" /><path d="M12 4.7a7.3 7.3 0 0 0-6.2 11.2l.2.3-.8 2.8 2.9-.8.3.2A7.3 7.3 0 1 0 12 4.7z" fill="currentColor" /><path d="M9.2 8.6c-.2 0-.4 0-.6.4l-.5 1c-.1.2-.2.5 0 .8.2.4.8 1.5 1.8 2.3 1.1 1 2 1.3 2.4 1.5.3.1.6 0 .8-.2l.9-1.1c.1-.2.4-.2.7-.1l1.5.7c.3.1.5.3.4.6 0 .4-.2 1.2-.8 1.8-.5.5-1.1.7-1.8.7-.5 0-1.2-.1-2.1-.5-.6-.2-1.3-.6-2-1.1-2.2-1.5-3.6-4-3.7-4.2-.1-.2-.9-1.2-.9-2.3 0-1.1.6-1.7.8-2 .3-.3.6-.4.8-.4h.4c.2 0 .5 0 .7.5l.6 1.6c.1.3.1.5 0 .7l-.3.5c-.1.1-.2.3-.3.4-.1.1-.2.3 0 .5.2.3.6 1 1.4 1.6.9.8 1.6 1.1 1.9 1.3.2.1.4 0 .6-.1l.4-.5c.2-.2.4-.2.6-.1l1.9.9" fill="#fff" /></svg>
  return <svg className={className} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" {...base} /></svg>
}

function Logo({ settings }) {
  return (
    <a href="#top" className="lp-logo" aria-label="Sayfanın başına dön">
      <img src="/images/landing-logo.png" alt={settings.siteTitle || 'PenPOS'} className="lp-logo-image" />
      <div>
        <div className="lp-logo-subtitle">Restoran • Mağaza • Market</div>
      </div>
    </a>
  )
}

const scrollToSection = (event, targetId) => {
  if (event) event.preventDefault()
  const element = document.getElementById(targetId)
  if (!element) return
  const top = Math.max(0, window.scrollY + element.getBoundingClientRect().top - 84)
  window.scrollTo({ top, behavior: 'smooth' })
}

function Header({ settings, onOpenSystems, onRegister, onLogin }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="lp-header-shell">
      <div className="lp-header">
        <Logo settings={settings} />
        <nav className="lp-nav">
          <a href="#sistemler" onClick={onOpenSystems}>Sistemler <Icon name="chevron" className="lp-nav-icon" /></a>
          <a href="#raporlar" onClick={(event) => scrollToSection(event, 'raporlar')}>Özellikler <Icon name="chevron" className="lp-nav-icon" /></a>
          <a href="#fiyat">Fiyat</a>
          <a href="#egitim">Eğitim Videoları</a>
        </nav>
        <div className="lp-header-actions">
          <button className="lp-btn lp-btn--text lp-direct-link-cta lp-direct-link-cta--login" type="button" onClick={onLogin}>Giriş Yap</button>
          <button className="lp-btn lp-btn--primary lp-direct-link-cta lp-direct-link-cta--register" type="button" onClick={onRegister}>1 Hafta Ücretsiz Dene</button>
        </div>
        <button type="button" className="lp-menu-btn" onClick={() => setOpen((value) => !value)} aria-label="Menü">
          <Icon name={open ? 'x' : 'menu'} className="lp-menu-icon" />
        </button>
      </div>
      {open ? (
        <div className="lp-mobile-nav">
          <a href="#sistemler" onClick={(event) => { setOpen(false); onOpenSystems?.(event) }}>Sistemler</a>
          <a href="#raporlar" onClick={(event) => { setOpen(false); scrollToSection(event, 'raporlar') }}>Özellikler</a>
          <a href="#fiyat" onClick={() => setOpen(false)}>Fiyat</a>
          <a href="#egitim" onClick={() => setOpen(false)}>Eğitim Videoları</a>
          <button className="lp-direct-link-cta lp-direct-link-cta--login" type="button" onClick={() => { setOpen(false); onLogin?.() }}>Giriş Yap</button>
          <button className="lp-btn lp-btn--primary lp-direct-link-cta lp-direct-link-cta--register" type="button" onClick={() => { setOpen(false); onRegister?.() }}>1 Hafta Ücretsiz Dene</button>
        </div>
      ) : null}
    </header>
  )
}

function MockVisual({ active }) {
  if (active === 'canteen') {
    return (
      <div className="lp-mock-grid lp-mock-grid--split">
        <div className="lp-soft-card">
          <div className="lp-card-top">
            <b>Mağaza / Market</b>
            <span>Barkod</span>
          </div>
          {['Ülker Metro', 'Dido Trio', 'Çilekli Süt'].map((item, index) => (
            <div key={item} className="lp-sale-row">
              <span>{item}</span>
              <b>{`₺${[15, 25, 20][index]},00`}</b>
            </div>
          ))}
        </div>
        <div className="lp-soft-card lp-soft-card--accent">
          <div className="lp-qr-chip">Canlı sistem</div>
          <h4>Telefonla hızlı satış</h4>
          <p>Online market mantığına uygun barkodlu ve hızlı kasa akışı.</p>
        </div>
      </div>
    )
  }

  if (active === 'qr') {
    return (
      <div className="lp-mock-grid lp-mock-grid--qr">
        <div className="lp-phone">
          <div className="lp-phone-notch" />
          <div className="lp-phone-body">
            <div className="lp-qr-chip">QR Menü</div>
            <h4>Kategori düzeni</h4>
            <div className="lp-phone-cats">
              {['Burger', 'İçecek', 'Tatlı', 'Kahve'].map((item) => <div key={item}>{item}</div>)}
            </div>
          </div>
        </div>
        <div className="lp-soft-card">
          <b>Sisteme dahil</b>
          <p>QR menü ekstra lisans olmadan restoran akışı içinde hazır gelir.</p>
        </div>
      </div>
    )
  }

  if (active === 'reports') {
    return (
      <div className="lp-mock-grid lp-mock-grid--reports">
        <div className="lp-soft-card">
          <div className="lp-card-top">
            <b>Z Raporu</b>
            <span>Anlık kontrol</span>
          </div>
          <div className="lp-report-stats">
            <div><small>Net Satış</small><strong>₺1.250</strong></div>
            <div><small>Şube</small><strong>4</strong></div>
            <div><small>Durum</small><strong>Hazır</strong></div>
          </div>
        </div>
        <div className="lp-soft-card">
          {['Ödeme Tipleri', 'Şube Performansı', 'Cari Bakiye', 'Günlük Özet'].map((item) => (
            <div key={item} className="lp-line-row">
              <span>{item}</span>
              <b>Hazır</b>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="lp-mock-grid lp-mock-grid--restaurant">
      <aside className="lp-mock-sidebar">
        <div className="lp-mini-brand">
          <div className="lp-mini-brand-box" />
          <strong>PenPOS</strong>
        </div>
        {['Anasayfa', 'Raporlar', 'Masalar', 'Hazirlanacaklar', 'Masasiz Satis', 'Paket Servis', 'Cari Hesaplar', 'Ayarlar'].map((item, index) => (
          <div key={item} className={`lp-mini-nav ${index === 0 ? 'is-active' : ''}`}>{item}</div>
        ))}
      </aside>
      <main>
        <div className="lp-soft-card lp-soft-card--green">
          <div className="lp-soft-title">Restoran ve Mağaza Ayrı Akış</div>
          <div className="lp-table-grid">
            {['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'Paket', 'Gel-Al'].map((item, index) => (
              <div key={item} className={`lp-table-cell ${index % 3 === 0 ? 'is-warm' : ''}`}>{item}</div>
            ))}
          </div>
          <div className="lp-kitchen-card"><b>Mutfak</b><div>Burger Menü • Hazır</div></div>
        </div>
      </main>
    </div>
  )
}

function DashboardPreview({ active, setActive }) {
  return (
    <div className="lp-preview-wrap">
      <div className="lp-preview-glow" />
      <div className="lp-preview-frame is-restaurant-preview">
        <div className="lp-preview-inner">
          <div className="lp-preview-visual">
            <MockVisual active={active} />
          </div>
        </div>
      </div>

      <div className="lp-tab-row">
        {tabs.map((tab) => {
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onMouseEnter={() => setActive(tab.key)}
              onFocus={() => setActive(tab.key)}
              onClick={() => setActive(tab.key)}
              className={`lp-tab ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={tab.icon} className="lp-tab-icon" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="lp-section-title">
      <div className="lp-section-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  )
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="lp-feature-card">
      <div className="lp-feature-icon"><Icon name={icon} className="lp-feature-icon-svg" /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="lp-feature-link">Daha Fazla <Icon name="arrow" className="lp-feature-link-icon" /></div>
    </div>
  )
}

function PricingCard({ title, text, highlight, buttonTo }) {
  return (
    <div className={`lp-pricing-card ${highlight ? 'is-highlight' : ''}`}>
      <div className="lp-pricing-head">
        <h3>{title}</h3>
        {highlight ? <span>Popüler</span> : null}
      </div>
      <div className="lp-pricing-price">Özel</div>
      <p>{text}</p>
      <Link className={`lp-pricing-btn ${highlight ? 'is-highlight' : ''}`} to={buttonTo}>1 Hafta Ücretsiz Dene</Link>
      <div className="lp-pricing-list">
        {['QR menü dahil', 'Sınırsız şube mantığı', 'Restoran ve mağaza ayrı akış', 'Canlı raporlar', 'Eğitim videoları'].map((item) => (
          <div key={item}><Icon name="check" className="lp-pricing-check" />{item}</div>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [settings, setSettings] = useState(defaultWebsiteSettings)
  const [loginOpen, setLoginOpen] = useState(false)
  const [active, setActive] = useState('restaurant')
  const nav = useNavigate()
  const showAndroidDownload = (() => {
    try {
      return !Capacitor.isNativePlatform()
    } catch {
      return true
    }
  })()

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = settings?.seoTitle || settings?.siteTitle || 'PenPOS'
  }, [settings?.seoTitle, settings?.siteTitle])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const res = await api('/api/public/website-settings', {
        silent: true,
        skipBranchHeader: true,
        cacheTtlMs: 10000
      })
      if (!cancelled && res?.ok && res?.settings) {
        setSettings({ ...defaultWebsiteSettings, ...res.settings })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', settings?.seoDescription || settings?.siteDescription || '')
    }
  }, [settings?.seoDescription, settings?.siteDescription])

  const featureCards = useMemo(() => {
    const list = Array.isArray(settings.features) ? settings.features : []
    return list.filter((item) => item?.active !== false).slice(0, 3)
  }, [settings.features])

  const trainingVideos = useMemo(() => {
    const list = Array.isArray(settings.trainingVideos) ? settings.trainingVideos : []
    return list
      .filter((item) => item?.active !== false)
      .slice(0, 3)
      .map((item) => {
        if (item?.id === 'video-1') {
          return { ...item, title: 'Üyelik ve İlk Kurulum', description: 'İlk hesap açılışı ve panel tanıtımı.' }
        }
        if (item?.id === 'video-2') {
          return { ...item, title: 'Restoran Satış Akışı', description: 'Masa ve adisyon akışının temel kullanımı.' }
        }
        if (item?.id === 'video-3') {
          return { ...item, title: 'Mağaza Barkodlu Satış', description: 'Hızlı kasa ve barkodlu satış örneği.' }
        }
        return item
      })
  }, [settings.trainingVideos])

  return (
    <div id="top" className="lp-page">
      <style>{`
        html { scroll-behavior: smooth; }
        .lp-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(28,23,20,.95) 0%, rgba(9,8,7,.92) 38%, rgba(0,0,0,1) 100%);
          color: #fff;
        }
        .lp-shell {
          width: min(1280px, calc(100% - 40px));
          margin: 0 auto;
        }
        .lp-header-shell {
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 0 20px;
          background: rgba(8,7,6,.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(110,98,90,.2);
        }
        .lp-header {
          width: min(1280px, 100%);
          height: 76px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 20px;
        }
        .lp-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          text-decoration: none;
        }
        .lp-logo-image {
          width: 150px;
          max-width: 100%;
          height: auto;
          display: block;
          flex: 0 0 auto;
        }
        .lp-logo-subtitle {
          margin-top: -2px;
          font-size: 11px;
          color: rgba(183,173,166,.55);
          font-weight: 500;
        }
        .lp-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 40px;
          color: rgba(255,255,255,.9);
          font-size: 14px;
          font-weight: 500;
          min-width: 0;
          white-space: nowrap;
        }
        .lp-nav a {
          color: inherit;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .lp-nav a:hover,
        .lp-btn--text:hover { color: #fff; }
        .lp-nav-icon {
          width: 12px;
          height: 12px;
        }
        .lp-header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          justify-content: flex-end;
          white-space: nowrap;
        }
        .lp-btn {
          border: 0;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s ease, background .28s ease;
        }
        .lp-btn:hover { transform: translateY(-2px) scale(1.02); }
        .lp-btn--text {
          background: transparent;
          color: rgba(255,255,255,.9);
          font-size: 14px;
          font-weight: 500;
        }
        .lp-btn--primary {
          border-radius: 10px;
          background: #b8734b;
          padding: 12px 20px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 18px 50px rgba(184,115,75,.25);
        }
        .lp-menu-btn {
          display: none;
          width: 40px;
          height: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #2a211d;
          color: #fff;
          border: 0;
        }
        .lp-menu-icon {
          width: 20px;
          height: 20px;
        }
        .lp-mobile-nav {
          display: none;
          width: min(1280px, 100%);
          margin: 0 auto;
          padding: 18px 0 22px;
          border-top: 1px solid rgba(110,98,90,.2);
          flex-direction: column;
          gap: 16px;
        }
        .lp-mobile-nav a,
        .lp-mobile-nav button {
          color: rgba(255,255,255,.82);
          background: transparent;
          border: 0;
          padding: 0;
          text-align: left;
          font: inherit;
          text-decoration: none;
        }
        .lp-main {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding-top: 76px;
        }
        .lp-hero {
          position: relative;
          width: min(1280px, calc(100% - 40px));
          margin: 0 auto;
          padding: 64px 0 96px;
        }
        .lp-hero-left-glow,
        .lp-hero-right-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(90px);
          pointer-events: none;
        }
        .lp-hero-left-glow {
          left: -120px;
          top: 120px;
          width: 380px;
          height: 380px;
          background: rgba(184,115,75,.1);
        }
        .lp-hero-right-glow {
          right: -120px;
          top: 140px;
          width: 420px;
          height: 420px;
          background: rgba(184,115,75,.15);
        }
        .lp-hero-inner {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .lp-hero-copy {
          max-width: 900px;
          text-align: center;
        }
        .lp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          background: #171717;
          padding: 8px 16px;
          color: #b8734b;
          font-size: 13px;
          font-weight: 700;
        }
        .lp-hero-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #b8734b;
        }
        .lp-hero-copy h1 {
          margin: 28px 0 0;
          font-size: clamp(48px, 6vw, 70px);
          line-height: 1.02;
          letter-spacing: -.07em;
          font-weight: 900;
          color: #fff;
        }
        .lp-hero-copy h1 span { color: #ffffff; }
        .lp-hero-copy p {
          margin: 24px auto 0;
          max-width: 760px;
          font-size: 18px;
          line-height: 1.78;
          color: rgba(199,189,181,.7);
        }
        .lp-hero-actions {
          margin-top: 32px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
        }
        .lp-hero-primary,
        .lp-hero-secondary,
        .lp-hero-download {
          padding: 16px 28px;
          border-radius: 12px;
          border: 0;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s ease;
        }
        .lp-hero-primary {
          background: #b8734b;
          color: #fff;
          box-shadow: 0 18px 50px rgba(184,115,75,.25);
        }
        .lp-hero-secondary {
          background: #000;
          color: #fff;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.15);
        }
        .lp-hero-download {
          background: linear-gradient(135deg, #d48a58 0%, #b8734b 100%);
          color: #fff;
          box-shadow: 0 22px 55px rgba(184,115,75,.34);
        }
        .lp-hero-primary:hover,
        .lp-hero-secondary:hover,
        .lp-hero-download:hover { transform: translateY(-2px) scale(1.03); }
        .lp-hero-points {
          margin-top: 28px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 20px;
          color: rgba(199,189,181,.7);
          font-size: 14px;
        }
        .lp-hero-points span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .lp-point-icon {
          width: 16px;
          height: 16px;
          color: #b8734b;
        }
        .lp-preview-wrap {
          position: relative;
          margin-top: 80px;
          width: 100%;
          max-width: 980px;
        }
        .lp-preview-glow {
          position: absolute;
          inset: -40px;
          border-radius: 999px;
          background: rgba(184,115,75,.2);
          filter: blur(90px);
        }
        .lp-preview-frame {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          border: 1px solid rgba(255,255,255,.15);
          background: #0a0908;
          padding: 12px;
          box-shadow: 0 40px 120px rgba(0,0,0,.65);
        }
        .lp-preview-inner {
          border-radius: 26px;
          border: 1px solid rgba(110,98,90,.2);
          background: #11100f;
          padding: 24px;
        }
        .lp-preview-header {
          margin-bottom: 24px;
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .lp-preview-kicker {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .16em;
          color: #b8734b;
        }
        .lp-preview-header h3 {
          margin: 12px 0 0;
          font-size: clamp(30px, 4vw, 36px);
          font-weight: 900;
          letter-spacing: -.06em;
          color: #fff;
        }
        .lp-preview-header p {
          margin: 8px 0 0;
          max-width: 620px;
          color: rgba(183,173,166,.65);
        }
        .lp-live-badge {
          border-radius: 999px;
          background: #2a201b;
          padding: 10px 16px;
          color: #d7a27f;
          font-size: 14px;
          font-weight: 700;
        }
        .lp-preview-header,
        .lp-preview-stats {
          display: none !important;
        }
        .lp-stat-card {
          border-radius: 16px;
          background: #1b1714;
          padding: 20px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
        }
        .lp-stat-card div {
          color: rgba(183,173,166,.55);
          font-size: 14px;
        }
        .lp-stat-card strong {
          display: block;
          margin-top: 16px;
          font-size: 30px;
          font-weight: 900;
          color: #fff;
        }
        .lp-preview-visual {
          margin-top: 0;
        }
        .lp-preview-frame.is-restaurant-preview .lp-preview-visual {
          margin-top: 0;
        }
        .lp-mock-grid {
          display: grid;
          gap: 16px;
        }
        .lp-mock-grid--restaurant {
          grid-template-columns: 1fr;
          min-height: 540px;
          border-radius: 28px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(8, 7, 6, 0.08), rgba(8, 7, 6, 0.08)),
            url('/images/restaurant-preview.png') center / contain no-repeat;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.26);
        }
        .lp-mock-grid--restaurant > * {
          display: none;
        }
        .lp-mock-grid--split,
        .lp-mock-grid--reports {
          grid-template-columns: 1fr;
          min-height: 540px;
          border-radius: 28px;
          background:
            linear-gradient(180deg, rgba(8, 7, 6, 0.04), rgba(8, 7, 6, 0.04)),
            center / contain no-repeat;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
        }
        .lp-mock-grid--split {
          background-image:
            linear-gradient(180deg, rgba(8, 7, 6, 0.04), rgba(8, 7, 6, 0.04)),
            url('/images/canteen-preview-v2.png');
        }
        .lp-mock-grid--split > *,
        .lp-mock-grid--reports > * {
          display: none;
        }
        .lp-mock-grid--qr {
          grid-template-columns: 1fr;
          min-height: 540px;
          border-radius: 28px;
          background:
            linear-gradient(180deg, rgba(8, 7, 6, 0.04), rgba(8, 7, 6, 0.04)),
            url('/images/qr-preview.png') center / contain no-repeat;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
          align-items: stretch;
        }
        .lp-mock-grid--qr > * {
          display: none;
        }
        .lp-mock-grid--reports {
          background-image:
            linear-gradient(180deg, rgba(8, 7, 6, 0.04), rgba(8, 7, 6, 0.04)),
            url('/images/reports-preview.png');
        }
        .lp-mock-sidebar {
          border-radius: 22px;
          background: rgba(0,0,0,.55);
          padding: 20px;
        }
        .lp-mini-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          color: #fff;
          font-weight: 900;
        }
        .lp-mini-brand-box {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #b8734b;
        }
        .lp-mini-nav {
          margin-bottom: 8px;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          color: rgba(183,173,166,.6);
        }
        .lp-mini-nav.is-active {
          background: rgba(184,115,75,.2);
          color: #d39a73;
        }
        .lp-soft-card {
          border-radius: 22px;
          background: #1b1714;
          padding: 20px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
        }
        .lp-soft-card--green {
          background: #071f1d;
        }
        .lp-soft-card--accent {
          background: #161210;
          box-shadow: inset 0 0 0 1px rgba(184,115,75,.2);
        }
        .lp-soft-title {
          margin-bottom: 16px;
          font-size: 22px;
          font-weight: 900;
          color: #fff;
        }
        .lp-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #fff;
        }
        .lp-card-top span {
          color: rgba(183,173,166,.55);
          font-size: 12px;
        }
        .lp-table-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .lp-table-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 64px;
          border-radius: 16px;
          background: #d8d1ca;
          color: #3c3632;
          font-weight: 900;
        }
        .lp-table-cell.is-warm {
          background: #e8d2bf;
          color: #6e3b2a;
        }
        .lp-kitchen-card {
          margin-top: 16px;
          border-radius: 16px;
          background: #2a211d;
          padding: 16px;
          color: #fff;
        }
        .lp-kitchen-card div {
          margin-top: 8px;
          color: rgba(199,189,181,.7);
        }
        .lp-sale-row,
        .lp-line-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 14px;
          background: rgba(12,11,10,.7);
          padding: 16px;
          color: #fff;
        }
        .lp-phone {
          border-radius: 24px;
          background: linear-gradient(180deg, #f8f3ee 0%, #ffffff 100%);
          padding: 18px;
        }
        .lp-phone-notch {
          width: 42%;
          height: 18px;
          border-radius: 999px;
          background: #11100f;
          margin: 0 auto 18px;
        }
        .lp-phone-body {
          border-radius: 20px;
          background: linear-gradient(180deg, #fff8ef 0%, #ffffff 100%);
          padding: 20px;
          min-height: 300px;
        }
        .lp-qr-chip {
          display: inline-flex;
          border-radius: 999px;
          background: rgba(184,115,75,.12);
          padding: 8px 12px;
          color: #8b5a3d;
          font-size: 12px;
          font-weight: 800;
        }
        .lp-phone-body h4 {
          margin: 16px 0 0;
          color: #2d2622;
          font-size: 26px;
          font-weight: 900;
        }
        .lp-phone-cats {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .lp-phone-cats div {
          border-radius: 16px;
          background: #f1e3d7;
          padding: 14px;
          color: #6e4d39;
          font-weight: 800;
        }
        .lp-report-stats {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .lp-report-stats div {
          border-radius: 14px;
          background: rgba(12,11,10,.72);
          padding: 14px;
        }
        .lp-report-stats small {
          display: block;
          color: rgba(183,173,166,.55);
        }
        .lp-report-stats strong {
          display: block;
          margin-top: 10px;
          color: #fff;
        }
        .lp-line-row b { color: #d7a27f; font-size: 12px; }
        .lp-tab-row {
          position: relative;
          z-index: 20;
          display: flex;
          justify-content: center;
          gap: 12px;
          margin: -40px auto 0;
        }
        .lp-tab {
          flex: 0 0 102px;
          width: 102px;
          height: 82px;
          box-sizing: border-box;
          padding: 0;
          border-radius: 24px;
          border: 1px solid rgba(110,98,90,.2);
          background: #11100f;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: rgba(255,255,255,.4);
          transition: all .3s ease;
          overflow: hidden;
        }
        .lp-tab:hover {
          color: #fff;
          border-color: rgba(184,115,75,.4);
        }
        .lp-tab.is-active {
          border-color: rgba(184,115,75,.7);
          background: #171717;
          color: #b8734b;
          box-shadow: 0 0 45px rgba(184,115,75,.28);
        }
        .lp-tab-icon {
          width: 28px;
          height: 28px;
        }
        .lp-tab span {
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          display: block;
        }
        .lp-section,
        .lp-pricing-band,
        .lp-footer {
          width: min(1210px, calc(100% - 40px));
          margin: 0 auto;
          padding: 96px 0;
        }
        .lp-pricing-band {
          border-top: 1px solid rgba(255,255,255,.08);
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: #080706;
          width: 100%;
          padding-left: 20px;
          padding-right: 20px;
          box-sizing: border-box;
        }
        .lp-pricing-band-inner {
          width: min(1210px, 100%);
          margin: 0 auto;
        }
        .lp-section-title {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }
        .lp-section-eyebrow {
          color: #b8734b;
          font-size: 14px;
          font-weight: 500;
        }
        .lp-section-title h2 {
          margin: 16px 0 0;
          color: #fff;
          font-size: clamp(38px, 4vw, 60px);
          line-height: 1.02;
          letter-spacing: -.06em;
          font-weight: 700;
        }
        .lp-section-title p {
          margin: 20px auto 0;
          max-width: 680px;
          color: rgba(183,173,166,.6);
          font-size: 18px;
          line-height: 1.8;
        }
        .lp-feature-grid {
          margin-top: 64px;
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .lp-feature-card {
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,.09);
          background: #11100f;
          padding: 24px;
          transition: transform .45s cubic-bezier(.22,1,.36,1), border-color .45s ease, background .45s ease, box-shadow .45s ease;
        }
        .lp-feature-card:hover {
          transform: translateY(-12px) scale(1.015);
          box-shadow: 0 30px 80px rgba(0,0,0,.45);
          border-color: rgba(184,115,75,.45);
          background: #151515;
        }
        .lp-feature-icon {
          display: flex;
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #2a211d;
          color: #b8734b;
        }
        .lp-feature-icon-svg {
          width: 24px;
          height: 24px;
        }
        .lp-feature-card h3 {
          margin: 32px 0 0;
          color: #fff;
          font-size: 30px;
          line-height: 1.1;
          letter-spacing: -.04em;
          font-weight: 700;
        }
        .lp-feature-card p {
          margin: 16px 0 0;
          color: rgba(255,255,255,.48);
          font-size: 15px;
          line-height: 1.86;
        }
        .lp-feature-link {
          margin-top: 32px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,.7);
          font-size: 14px;
        }
        .lp-feature-link-icon {
          width: 16px;
          height: 16px;
        }
        .lp-operation-grid {
          margin-top: 64px;
          display: grid;
          gap: 24px;
          grid-template-columns: 1.1fr .9fr;
        }
        .lp-operation-main,
        .lp-operation-card {
          border-radius: 34px;
          border: 1px solid rgba(255,255,255,.08);
          background: #11100f;
          padding: 28px;
        }
        .lp-operation-label {
          color: #b8734b;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .18em;
        }
        .lp-operation-main h3,
        .lp-operation-card h3 {
          margin: 12px 0 0;
          color: #fff;
          font-size: clamp(28px, 3.2vw, 42px);
          line-height: 1.06;
          letter-spacing: -.06em;
          font-weight: 900;
        }
        .lp-operation-list {
          margin-top: 32px;
          display: grid;
          gap: 16px;
        }
        .lp-operation-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,.06);
          background: rgba(12,11,10,.75);
          padding: 20px;
        }
        .lp-operation-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .lp-operation-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #b8734b;
        }
        .lp-operation-copy strong {
          color: #fff;
          font-weight: 900;
        }
        .lp-operation-copy div {
          margin-top: 4px;
          color: rgba(183,173,166,.55);
          font-size: 14px;
        }
        .lp-operation-time {
          color: rgba(255,255,255,.35);
          font-size: 14px;
        }
        .lp-operation-side {
          display: grid;
          gap: 20px;
        }
        .lp-operation-mini-grid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .lp-operation-mini-grid div {
          border-radius: 24px;
          background: rgba(12,11,10,.7);
          padding: 20px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
        }
        .lp-operation-mini-grid strong {
          color: #fff;
          font-weight: 900;
        }
        .lp-operation-mini-grid span {
          display: block;
          margin-top: 8px;
          color: rgba(183,173,166,.55);
          font-size: 14px;
        }
        .lp-operation-card--accent {
          border-color: rgba(184,115,75,.2);
          background: #161210;
        }
        .lp-operation-card--accent p {
          margin: 20px 0 0;
          color: rgba(183,173,166,.65);
          font-size: 18px;
          line-height: 1.8;
        }
        .lp-branch-number {
          color: #b8734b;
          font-size: 52px;
          font-weight: 900;
        }
        .lp-pricing-grid {
          margin: 64px auto 0;
          max-width: 860px;
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .lp-video-grid {
          margin-top: 64px;
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .lp-video-card {
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,.09);
          background: #11100f;
          padding: 24px;
          text-align: left;
          color: inherit;
          cursor: pointer;
          transition: transform .45s cubic-bezier(.22,1,.36,1), border-color .45s ease, background .45s ease, box-shadow .45s ease;
        }
        .lp-video-card:hover {
          transform: translateY(-12px) scale(1.015);
          box-shadow: 0 30px 80px rgba(0,0,0,.45);
          border-color: rgba(184,115,75,.45);
          background: #151515;
        }
        .lp-video-icon-box {
          display: flex;
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #2a211d;
          color: #b8734b;
        }
        .lp-video-icon {
          width: 24px;
          height: 24px;
        }
        .lp-video-card strong {
          display: block;
          margin-top: 24px;
          color: #fff;
          font-size: 24px;
          line-height: 1.12;
          letter-spacing: -.04em;
          font-weight: 800;
        }
        .lp-video-card p {
          margin: 14px 0 0;
          color: rgba(255,255,255,.48);
          font-size: 15px;
          line-height: 1.86;
        }
        .lp-video-link {
          margin-top: 28px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,.7);
          font-size: 14px;
        }
        .lp-pricing-card {
          border-radius: 32px;
          border: 1px solid rgba(255,255,255,.09);
          background: #11100f;
          padding: 28px;
        }
        .lp-pricing-card.is-highlight {
          border-color: rgba(184,115,75,.6);
          background: #161210;
        }
        .lp-pricing-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .lp-pricing-head h3 {
          color: #fff;
          font-size: 30px;
          line-height: 1.1;
          letter-spacing: -.04em;
          font-weight: 700;
          margin: 0;
        }
        .lp-pricing-head span {
          border-radius: 999px;
          background: #b8734b;
          padding: 4px 12px;
          color: #fff;
          font-size: 12px;
        }
        .lp-pricing-price {
          margin-top: 24px;
          color: #fff;
          font-size: 56px;
          line-height: 1;
          letter-spacing: -.07em;
          font-weight: 700;
        }
        .lp-pricing-card p {
          margin: 16px 0 0;
          color: rgba(183,173,166,.55);
        }
        .lp-pricing-btn {
          margin-top: 32px;
          width: 100%;
          border-radius: 999px;
          padding: 14px 20px;
          text-decoration: none;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          color: #000;
        }
        .lp-pricing-btn.is-highlight {
          background: #b8734b;
          color: #fff;
        }
        .lp-pricing-list {
          margin-top: 32px;
          display: grid;
          gap: 12px;
        }
        .lp-pricing-list div {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(199,189,181,.75);
          font-size: 14px;
        }
        .lp-pricing-check {
          width: 16px;
          height: 16px;
          color: #b8734b;
          flex: 0 0 auto;
        }
        .lp-footer {
          border-top: 1px solid rgba(255,255,255,.08);
          background: #000;
          width: 100%;
          padding: 48px 20px;
          box-sizing: border-box;
        }
        .lp-footer-inner {
          width: min(1210px, 100%);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 32px;
        }
        .lp-footer-copy {
          color: rgba(255,255,255,.35);
          font-size: 14px;
        }
        .lp-footer-contact {
          display: grid;
          gap: 12px;
        }
        .lp-footer-contact-title {
          color: #fff;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -.02em;
        }
        .lp-footer-contact-links {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .lp-footer-contact-links a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.04);
          color: #fff;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: transform .24s ease, border-color .24s ease, background .24s ease;
        }
        .lp-footer-contact-links a:hover {
          transform: translateY(-1px);
          border-color: rgba(184,115,75,.6);
          background: rgba(184,115,75,.12);
        }
        .lp-floating-whatsapp {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 60;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 45px;
          padding: 7px 12px 7px 7px;
          border-radius: 999px;
          background: rgba(255,255,255,.96);
          color: #111827;
          text-decoration: none;
          box-shadow: 0 20px 45px rgba(0,0,0,.18);
          border: 1px solid rgba(15,23,42,.08);
          transition: transform .24s ease, box-shadow .24s ease;
        }
        .lp-floating-whatsapp:hover {
          transform: translateY(-2px);
          box-shadow: 0 24px 52px rgba(0,0,0,.24);
        }
        .lp-floating-whatsapp-icon {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: linear-gradient(180deg, #25d366 0%, #16a34a 100%);
          color: #fff;
        }
        .lp-floating-whatsapp-icon svg {
          width: 17px;
          height: 17px;
        }
        .lp-floating-whatsapp-copy {
          display: grid;
          gap: 2px;
          line-height: 1.1;
        }
        .lp-floating-whatsapp-copy strong {
          color: #111827;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: -.02em;
        }
        .lp-floating-whatsapp-copy span {
          color: #16a34a;
          font-size: 9px;
          font-weight: 700;
        }
        .lp-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(0,0,0,.62);
          backdrop-filter: blur(14px);
        }
        .lp-modal {
          width: min(920px, 100%);
          border-radius: 32px;
          background: #11100f;
          border: 1px solid rgba(255,255,255,.08);
          padding: 24px;
          box-shadow: 0 28px 80px rgba(0,0,0,.45);
        }
        .lp-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .lp-modal-head h3 {
          margin: 12px 0 0;
          color: #fff;
          font-size: 34px;
          line-height: 1.06;
          letter-spacing: -.05em;
          font-weight: 900;
        }
        .lp-modal-head p {
          margin: 12px 0 0;
          color: rgba(183,173,166,.65);
          line-height: 1.7;
        }
        .lp-close {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 0;
          background: #2a211d;
          color: #fff;
          font-size: 24px;
        }
        .lp-login-grid {
          margin-top: 20px;
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .lp-login-card {
          border-radius: 26px;
          border: 1px solid rgba(255,255,255,.08);
          padding: 24px;
          text-decoration: none;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .lp-login-card--dark {
          background: #0f0f0e;
          color: #fff;
        }
        .lp-login-card--accent {
          background: #161210;
          color: #fff;
          border-color: rgba(184,115,75,.2);
        }
        .lp-login-card strong {
          display: block;
          margin-top: 16px;
          color: #fff;
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: -.04em;
        }
        .lp-login-card p {
          margin: 12px 0 0;
          color: rgba(183,173,166,.72);
        }
        .lp-login-icon {
          width: 32px;
          height: 32px;
        }
        @media (max-width: 1100px) {
          .lp-preview-stats,
          .lp-feature-grid,
          .lp-operation-grid,
          .lp-video-grid {
            grid-template-columns: 1fr;
          }
          .lp-mock-grid--restaurant,
          .lp-mock-grid--split,
          .lp-mock-grid--qr,
          .lp-mock-grid--reports,
          .lp-pricing-grid,
          .lp-login-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 900px) {
          .lp-header {
            grid-template-columns: auto 1fr auto;
          }
          .lp-nav,
          .lp-header-actions {
            display: none;
          }
          .lp-menu-btn {
            display: inline-flex;
          }
          .lp-mobile-nav {
            display: flex;
          }
          .lp-hero-copy h1 {
            font-size: 52px;
          }
          .lp-tab-row {
            flex-wrap: wrap;
          }
        }
        @media (max-width: 720px) {
          .lp-header-shell {
            padding: 0 10px;
          }
          .lp-main {
            padding-top: 76px;
          }
          .lp-hero,
          .lp-section {
            width: calc(100% - 20px);
          }
          .lp-hero {
            padding-top: 40px;
            padding-bottom: 60px;
          }
          .lp-hero-copy h1 {
            font-size: 40px;
          }
          .lp-hero-copy p,
          .lp-section-title p,
          .lp-operation-card--accent p {
            font-size: 16px;
            line-height: 1.7;
          }
        .lp-preview-wrap {
          margin-top: 48px;
          scroll-margin-top: 96px;
        }
          .lp-preview-inner,
          .lp-operation-main,
          .lp-operation-card,
          .lp-video-card,
          .lp-pricing-card,
          .lp-feature-card,
          .lp-modal {
            padding: 20px;
          }
          .lp-tab {
            width: calc(50% - 6px);
          }
          .lp-table-grid,
          .lp-phone-cats,
          .lp-operation-mini-grid,
          .lp-report-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .lp-hero-actions {
            gap: 12px;
          }
          .lp-hero-primary,
          .lp-hero-secondary,
          .lp-hero-download {
            width: 100%;
          }
          .lp-hero-download {
            font-size: 15px;
            padding: 18px 24px;
          }
          .lp-floating-whatsapp {
            right: 14px;
            bottom: 14px;
            min-height: 35px;
            padding: 5px 9px 5px 5px;
            gap: 6px;
          }
          .lp-floating-whatsapp-icon {
            width: 23px;
            height: 23px;
          }
          .lp-floating-whatsapp-icon svg {
            width: 13px;
            height: 13px;
          }
          .lp-floating-whatsapp-copy strong {
            font-size: 9px;
          }
          .lp-floating-whatsapp-copy span {
            font-size: 7px;
          }
        }
      `}</style>

      <Header
        settings={settings}
        onRegister={() => nav(`${settings.registerUrl || '/register'}?type=restaurant`)}
        onLogin={() => nav('/login')}
        onOpenSystems={(event) => {
          setActive('restaurant')
          scrollToSection(event, 'sistemler')
        }}
      />

      <main className="lp-main">
        <section id="sistemler" className="lp-hero">
          <div className="lp-hero-left-glow" />
          <div className="lp-hero-right-glow" />
          <div className="lp-hero-inner">
            <div className="lp-hero-copy">
              <div className="lp-hero-badge"><span className="lp-hero-badge-dot" /> YENİ NESİL SATIŞ VE ADİSYON YÖNETİMİ</div>
              <h1><span>{settings.heroTitle || 'Restoran ve mağaza sistemlerini ayrı ayrı yönetin.'}</span></h1>
              <p>{settings.heroDescription || 'PenPOS; Restoran-Cafe ve Mağaza-Market için ayrı girişleri, ayrı ekran akışları olan modern otomasyon yapısıdır.'}</p>
              <div className="lp-hero-actions">
                <button className="lp-hero-primary lp-direct-link-cta lp-direct-link-cta--register" type="button" onClick={() => nav('/register')}>1 Haftalık Ücretsiz Deneme</button>
                <button className="lp-hero-secondary lp-direct-link-cta lp-direct-link-cta--login" type="button" onClick={() => nav('/login')}>Giriş Yap</button>
                {showAndroidDownload ? (
                  <a
                    className="lp-hero-download"
                    href="https://drive.google.com/uc?id=1_QZs8wYc0mtVSfPtBllJIXt5r-e9M9iv&export=download"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Android Uygulamasını İndir
                  </a>
                ) : null}
              </div>
              <div className="lp-hero-points">
                {['QR menü dahil', 'Sınırsız şube', 'YouTube eğitim videoları'].map((item) => (
                  <span key={item}><Icon name="check" className="lp-point-icon" />{item}</span>
                ))}
              </div>
            </div>

            <DashboardPreview active={active} setActive={setActive} />
          </div>
        </section>

        <section id="sistem-kartlari" className="lp-section">
          <SectionTitle eyebrow="PenPOS Yapısı" title="Restoran ve mağaza aynı çatı altında, ayrı sistem mantığında." text="Her sistem kendi girişine ve ekran akışına sahip olur. Firma isterse restoran, isterse mağaza/market yapısıyla ilerler." />
          <div className="lp-feature-grid">
            <FeatureCard icon="store" title="Restoran / Cafe" text="Masa, adisyon, mutfak, paket servis, kurye ve QR menü akışları restoran tarafında birlikte çalışır." />
            <FeatureCard icon="cart" title="Mağaza / Market" text="Barkodlu hızlı satış, ürün fiyat listesi, stok ve online satış mantığı mağaza tarafına uyarlanır." />
            <FeatureCard icon="chart" title="Canlı Raporlar" text="Z raporu, ödeme tipleri, şube filtreleri ve cari bakiye gibi veriler tek panelde izlenir." />
          </div>
        </section>

        <section id="raporlar" className="lp-section">
          <SectionTitle eyebrow="Canlı İşletme Yönetimi" title="Tüm operasyonları tek panelden kontrol edin." text="Mutfak hazırlığından kurye akışına, cari hesaplardan canlı raporlara kadar tüm işletme süreçleri PenPOS içinde birleşir." />
          <div className="lp-operation-grid">
            <div className="lp-operation-main">
              <div className="lp-operation-label">CANLI İŞLEM AKIŞI</div>
              <h3>Anlık sipariş hareketleri</h3>
              <div className="lp-operation-list">
                {[
                  ['SALON 1 • Masa 4', 'Sipariş hazırlanıyor', '2 dk önce'],
                  ['Paket Servis #102', 'Kurye teslim aldı', 'Şimdi'],
                  ['Cari Hesap', 'Tahsilat tamamlandı', '1 dk önce'],
                  ['QR Menü', 'Yeni sipariş geldi', 'Canlı']
                ].map(([title, desc, time]) => (
                  <div key={title} className="lp-operation-item">
                    <div className="lp-operation-left">
                      <div className="lp-operation-dot" />
                      <div className="lp-operation-copy">
                        <strong>{title}</strong>
                        <div>{desc}</div>
                      </div>
                    </div>
                    <div className="lp-operation-time">{time}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-operation-side">
              <div className="lp-operation-card">
                <div className="lp-operation-label">QR MENÜ SİSTEMİ</div>
                <h3>QR menü standart olarak dahildir.</h3>
                <div className="lp-operation-mini-grid">
                  {[
                    ['Telefon uyumlu', 'Mobil görünüm'],
                    ['Kategori düzeni', 'Ürün görselleri'],
                    ['Şube bazlı kullanım', 'QR tema sistemi'],
                    ['Sipariş aktarımı', 'Cari bağlantısı']
                  ].map(([a, b]) => (
                    <div key={a}>
                      <strong>{a}</strong>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-operation-card lp-operation-card--accent">
                <div className="lp-operation-label">ŞUBE YÖNETİMİ</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <h3>Sınırsız şube mantığı</h3>
                  <div className="lp-branch-number">+12</div>
                </div>
                <p>Her işletme istediği kadar şube açabilir, şubeleri ayrı raporlayabilir ve tüm verileri tek panelden yönetebilir.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="fiyat" className="lp-pricing-band">
          <div className="lp-pricing-band-inner">
            <SectionTitle eyebrow="Fiyatlandırma" title="1 haftalık ücretsiz deneme ile başlayın." text="Demo talep etmek yerine kullanıcı doğrudan deneyebilir; giriş yap alanı mevcut üyeler için açık kalır." />
            <div className="lp-pricing-grid">
              <PricingCard title="Başlangıç" text="İşletmenize, şube sayınıza ve kullanım yoğunluğunuza göre özelleştirilir." buttonTo={`${settings.registerUrl || '/register'}?type=restaurant`} />
              <PricingCard title="Restoran + Mağaza" text="İşletmenize, şube sayınıza ve kullanım yoğunluğunuza göre özelleştirilir." highlight buttonTo={`${settings.registerUrl || '/register'}?type=market`} />
            </div>
          </div>
        </section>

        <section id="egitim" className="lp-section">
          <SectionTitle eyebrow="Eğitim Videoları" title="Sistemi kısa videolarla hızlı öğrenin." text="Kurulum, satış, cari hesap, QR menü ve raporlama akışlarını mevcut eğitim videolarıyla adım adım izleyebilirsiniz." />
          <div className="lp-video-grid">
            {trainingVideos.map((video) => (
              <div key={video.id} className="lp-video-card">
                <div className="lp-video-icon-box">
                  <Icon name="play" className="lp-video-icon" />
                </div>
                <strong>{video.title}</strong>
                <p>{video.description || 'Video açıklaması daha sonra eklenecek.'}</p>
                <div className="lp-video-link">Video bağlantısı daha sonra eklenecek</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <a
        href="https://wa.me/905313375562"
        target="_blank"
        rel="noopener noreferrer"
        className="lp-floating-whatsapp"
        aria-label="WhatsApp hattı"
      >
        <span className="lp-floating-whatsapp-icon">
          <Icon name="whatsapp" />
        </span>
        <span className="lp-floating-whatsapp-copy">
          <strong>WhatsApp</strong>
          <strong>Hattı</strong>
          <span>Çevrimiçi</span>
        </span>
      </a>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Logo settings={settings} />
          <div className="lp-footer-contact">
            <div className="lp-footer-contact-title">İletişim</div>
            <div className="lp-footer-contact-links">
              <a href="mailto:penpos.app@gmail.com">penpos.app@gmail.com</a>
              <a href="tel:+905313375562">0531 337 55 62</a>
              <a href="https://wa.me/905313375562" target="_blank" rel="noopener noreferrer">WhatsApp: 0531 337 55 62</a>
            </div>
          </div>
          <div className="lp-footer-copy">© 2026 PenPOS. Restoran, mağaza ve market otomasyon sistemi.</div>
        </div>
      </footer>

      {loginOpen ? (
        <div className="lp-modal-backdrop" onClick={() => setLoginOpen(false)}>
          <div className="lp-modal" onClick={(event) => event.stopPropagation()}>
            <div className="lp-modal-head">
              <div>
                <div className="lp-live-badge">Giriş seçimi</div>
                <h3>Giriş yapmak istediğiniz sistemi seçin</h3>
                <p>Mevcut sayfa bağlantıları, login akışları ve yönlendirmeler korunur.</p>
              </div>
              <button className="lp-close" type="button" onClick={() => setLoginOpen(false)}>×</button>
            </div>
            <div className="lp-login-grid">
              <button type="button" className="lp-login-card lp-login-card--dark public-touch-card" onClick={() => nav(settings.restaurantLoginUrl || '/login?type=restaurant')}>
                <Icon name="store" className="lp-login-icon" />
                <strong>Restoran / Cafe Girişi</strong>
                <p>Masa, adisyon, paket servis, mutfak ve QR menü akışı.</p>
              </button>
              <button type="button" className="lp-login-card lp-login-card--accent public-touch-card" onClick={() => nav(settings.marketLoginUrl || '/login?type=market')}>
                <Icon name="cart" className="lp-login-icon" />
                <strong>Mağaza / Market Girişi</strong>
                <p>Barkodlu hızlı satış, stok hareketi ve cari hesap akışı.</p>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


