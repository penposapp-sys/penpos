import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import BranchSelectorModal from './BranchSelectorModal.jsx'
import MobileTopSheetNav from './MobileTopSheetNav.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function Layout() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { user, logout, tenantCtx } = useAuth()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [desktopCollapsed, setDesktopCollapsed] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    try { document.body.classList.add('scroll-lock') } catch {}
    return () => {
      try { document.body.classList.remove('scroll-lock') } catch {}
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const enabled = !!(isMobilePortrait && (
      pathname.startsWith('/kermes/app/pos') ||
      pathname.startsWith('/kermes/app/walkin') ||
      pathname.startsWith('/kermes/app/delivery')
    ))

    try {
      if (enabled) document.body.classList.add('sales-mobile-scroll')
      else document.body.classList.remove('sales-mobile-scroll')
    } catch {}

    return () => {
      try { document.body.classList.remove('sales-mobile-scroll') } catch {}
    }
  }, [isMobilePortrait, pathname])

  useEffect(() => {
    try {
      if (isMobilePortrait) document.body.classList.add('mobile-ui')
      else document.body.classList.remove('mobile-ui')
    } catch {}

    return () => {
      try { document.body.classList.remove('mobile-ui') } catch {}
    }
  }, [isMobilePortrait])
  useEffect(() => {
    if (pathname.startsWith('/login/platform')) document.title = 'PenPOS – Platform Yönetimi Girişi'
    else if (pathname.startsWith('/login/restoran')) document.title = 'PenPOS – Restoran Girişi'
    else if (pathname.startsWith('/login/kantin')) document.title = 'PenPOS – Kantin Girişi'
    else if (pathname === '/') document.title = 'PenPOS – Giriş Seçimi'
    else if (pathname.startsWith('/superadmin/tenants')) document.title = 'PenPOS – Üyeler'
    else if (pathname.startsWith('/platform/payments')) document.title = 'PenPOS – Ödeme Talepleri'
    else if (pathname.startsWith('/platform/kermes-tenants')) document.title = 'PenPOS – Kermes Üyeler'
    else if (pathname.startsWith('/platform/canteen-tenants')) document.title = 'PenPOS – Kantin Üyeler'
    else if (pathname.startsWith('/platform/plans')) document.title = 'PenPOS – Paketler'
    else if (pathname.startsWith('/kermes')) document.title = 'PenPOS – Kermes'
    else document.title = 'PenPOS'
  }, [pathname])
  const IconHome = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H10v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
  const IconTables = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M7 10v10M17 10v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )
  const IconTableRestaurant = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 10v10M17 10v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 7h3v3H6V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M15 7h3v3h-3V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
  const IconUtensils = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 3v8a3 3 0 0 0 6 0V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M7 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M14 3v10a3 3 0 0 0 6 0V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M17 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M7 14v7M17 14v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )
  const IconShoppingCart = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6h15l-1.5 9H7.5L6 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 6L4 4H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="20" r="1" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="20" r="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
  const IconTruck = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M3 7h11v11H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M14 10h4l3 3v5h-7v-8z" stroke="currentColor" strokeWidth="2"/><circle cx="7" cy="20" r="2" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="20" r="2" stroke="currentColor" strokeWidth="2"/></svg>
  )
  const IconFileCheck = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 2h9l3 3v17H6V2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M15 2v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 14.5l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const IconWallet = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M3 7h18v14H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M21 11h-6a2 2 0 0 0 0 4h6v-4z" stroke="currentColor" strokeWidth="2"/><path d="M3 7l14-3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )
  const IconSettings = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a7.96 7.96 0 0 0 .1-2 7.96 7.96 0 0 0-.1-2l2.1-1.6-2-3.5-2.5 1a8.2 8.2 0 0 0-3.4-2l-.4-2.6h-4l-.4 2.6a8.2 8.2 0 0 0-3.4 2l-2.5-1-2 3.5L4.6 9a7.96 7.96 0 0 0-.1 2c0 .7.1 1.4.1 2l-2.1 1.6 2 3.5 2.5-1a8.2 8.2 0 0 0 3.4 2l.4 2.6h4l.4-2.6a8.2 8.2 0 0 0 3.4-2l2.5 1 2-3.5-2.1-1.6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
  const IconShieldCheck = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M8.5 12.5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
  const IconStore = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 7l1-3h14l1 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M4 7v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M5 10v11h14V10" stroke="currentColor" strokeWidth="2"/><path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="2"/></svg>
  )
  const IconBuilding = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 21V3h16v18" stroke="currentColor" strokeWidth="2"/><path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10 21v-4h4v4" stroke="currentColor" strokeWidth="2"/></svg>
  )
  const IconLayers = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M3 16l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
  )
  const IconCreditCard = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M7 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )
  const IconUserCog = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M4 21v-1a7 7 0 0 1 14 0v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19.5 14.5l1 1.7-1 1.7-2-.3-.8 1.9-1.8-1.1-1.8 1.1-.8-1.9-2 .3-1-1.7 1-1.7 2 .3.8-1.9 1.8 1.1 1.8-1.1.8 1.9 2-.3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  )
  const IconLogin = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5M3 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
  const IconWalkIn = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
  const IconDelivery = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="1" y="3" width="15" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="2"/><circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/><circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>
  )
  const IconAccounts = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 7h16M7 4v6M17 4v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M5 10h14v10H5V10z" stroke="currentColor" strokeWidth="2"/><path d="M8 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )
  const items = []
  if (!user) {
    items.push({ path: '/', label: 'Giriş', icon: IconLogin, show: true })
  } else if (user.role === 'superadmin') {
    items.push({ path: '/superadmin/tenants', label: 'Üyeler', icon: IconTenant, show: true })
  } else if (user.role === 'platform_admin') {
    items.push({ path: '/platform/kermes-tenants', label: 'Kermes Üyeler', icon: IconStore, show: true })
    items.push({ path: '/platform/canteen-tenants', label: 'Kantin Üyeler', icon: IconBuilding, show: true })
    items.push({ path: '/platform/plans', label: 'Paketler', icon: IconLayers, show: true })
    items.push({ path: '/platform/payments', label: 'Ödeme Talepleri', icon: IconCreditCard, show: true })
    items.push({ path: '/platform/settings/me', label: 'Hesabım', icon: IconUserCog, show: true })
  } else {
    const isExpired = tenantCtx?.tenant?.plan?.status === 'expired'
    const perms = Array.isArray(user?.permissions) ? user.permissions : []
    const canSettings = user.role === 'tenant_admin' || perms.includes('manage_settings') || perms.includes('manage_menu')
    if (user.role === 'tenant_admin' || (user.permissions || []).includes('reports_dashboard_view')) {
      items.push({ path: '/kermes/app/dashboard', label: 'Anasayfa', icon: IconHome, show: true })
    }
    if (user.role === 'tenant_admin' || (user.permissions || []).includes('manage_tables')) items.push({ path: '/kermes/app/tables', label: 'Masalar', icon: IconTableRestaurant, show: true })
    if (!isExpired && (user.role === 'tenant_admin' || (user.permissions || []).includes('kitchen_access'))) {
      items.push({ path: '/kermes/app/kitchen', label: 'Hazırlanacaklar', icon: IconUtensils, show: true })
      items.push({ path: '/kermes/app/kitchen/bulk', label: 'Toplu Hazırlama', icon: IconUtensils, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || ((user.permissions || []).includes('pos_access') && (user.permissions || []).includes('walkin_access')))) items.push({ path: '/kermes/app/walkin', label: 'Masasız Satış', icon: IconShoppingCart, show: true })
    if (!isExpired && (user.role === 'tenant_admin' || ((user.permissions || []).includes('pos_access') && (user.permissions || []).includes('view_delivery')))) items.push({ path: '/kermes/app/delivery', label: 'Paket Servis', icon: IconTruck, show: true })
    if (!isExpired && (user.role === 'tenant_admin' || (user.permissions || []).includes('closed_tables_page_view'))) {
      items.push({ path: '/kermes/app/reports/sales', label: 'Kapanan Masalar', icon: IconFileCheck, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('view_accounts') || perms.includes('manage_accounts'))) items.push({ path: '/kermes/app/accounts', label: 'Cari Hesaplar', icon: IconWallet, show: true })
    if (canSettings) items.push({ path: '/kermes/settings', label: 'Ayarlar', icon: IconSettings, show: true })
    if (user.role === 'tenant_admin' || (user.permissions || []).includes('audit_view')) items.push({ path: '/kermes/app/audit', label: 'Denetim', icon: IconShieldCheck, show: true })
  }
  const navItems = useMemo(() => {
    return items
      .filter(i => i.show !== false)
      .map(i => ({
        to: i.path,
        label: i.label,
        icon: i.icon,
        active: pathname === i.path || (i.path !== '/kermes/app/kitchen' && pathname.startsWith(i.path + '/'))
      }))
  }, [pathname, items])

  const current = navItems
    .filter(i => i.active)
    .sort((a, b) => String(b.to || '').length - String(a.to || '').length)[0]

  const gridCols = isMobilePortrait
    ? '1fr'
    : (desktopCollapsed ? `${isTablet ? 64 : 56}px 1fr` : '220px 1fr')

  return (
    <div className="app" style={{ gridTemplateColumns: gridCols, gridTemplateRows: '56px 1fr' }}>
      <BranchSelectorModal />
      <MobileTopSheetNav
        open={isMobilePortrait && mobileMenuOpen}
        title="Menü"
        items={navItems}
        onClose={() => setMobileMenuOpen(false)}
        onSelect={(i) => {
          if (!i?.to) return
          nav(i.to)
        }}
      />
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="hamburger-btn"
            style={{ width: 36, height: 28, display: 'grid', placeItems: 'center' }}
            aria-label="Menü"
            onClick={() => {
              if (isMobilePortrait) setMobileMenuOpen(v => !v)
              else setDesktopCollapsed(v => !v)
            }}
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => nav('/')}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            aria-label="Anasayfa"
          >
            <img src="/penpos%20logo.png" alt="PenPOS" style={{ height: 28, pointerEvents: 'none' }} onError={(e) => { e.currentTarget.src = '/penpos-logo.png' }} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
          {current && <span className="page-pill">{current.label}</span>}
          {!user && 'Giriş Yap'}
        </div>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {user && <button className="btn" onClick={logout}>Çıkış</button>}
          </div>
        </div>
      </header>
      {!isMobilePortrait && (
        <aside className={desktopCollapsed ? 'sidebar icon-rail' : 'sidebar'}>
          <nav style={{ display: 'grid', gap: 8 }}>
            {navItems.map(i => {
              const Icon = i.icon
              const active = !!i.active
              return (
                <button
                  key={i.to}
                  type="button"
                  className={active ? 'active nav-link' : 'nav-link'}
                  onClick={() => nav(i.to)}
                  style={{ justifyContent: desktopCollapsed ? 'center' : 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span className="nav-icon"><Icon size={18} /></span>
                  {!desktopCollapsed && <span className="nav-label">{i.label}</span>}
                </button>
              )
            })}
          </nav>
          {import.meta.env.DEV && user && !desktopCollapsed && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.3 }}>
              <div>role: {String(user.role)}</div>
              <div>perms: {(Array.isArray(user.permissions) ? user.permissions : []).length}</div>
              <div>manage_settings: {String((Array.isArray(user.permissions) ? user.permissions : []).includes('manage_settings'))}</div>
              <div>manage_menu: {String((Array.isArray(user.permissions) ? user.permissions : []).includes('manage_menu'))}</div>
              <div>manage_accounts: {String((Array.isArray(user.permissions) ? user.permissions : []).includes('manage_accounts'))}</div>
            </div>
          )}
        </aside>
      )}
      <main className="main"><Outlet /></main>
      
    </div>
  )
}
