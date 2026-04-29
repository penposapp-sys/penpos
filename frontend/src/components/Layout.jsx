import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Users as IconTenant } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import BranchSelectorModal from './BranchSelectorModal.jsx'
import MobileTopSheetNav from './MobileTopSheetNav.jsx'

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
    if (pathname.startsWith('/login/platform')) document.title = 'PenPOS - Platform Yonetimi Girisi'
    else if (pathname.startsWith('/login/restoran')) document.title = 'PenPOS - Restoran Girisi'
    else if (pathname.startsWith('/login/kantin')) document.title = 'PenPOS - Kantin Girisi'
    else if (pathname === '/') document.title = 'PenPOS - Giris Secimi'
    else if (pathname.startsWith('/superadmin/tenants')) document.title = 'PenPOS - Uyeler'
    else if (pathname.startsWith('/platform/payments')) document.title = 'PenPOS - Odeme Talepleri'
    else if (pathname.startsWith('/platform/kermes-tenants')) document.title = 'PenPOS - Kermes Uyeler'
    else if (pathname.startsWith('/platform/canteen-tenants')) document.title = 'PenPOS - Kantin Uyeler'
    else if (pathname.startsWith('/platform/plans')) document.title = 'PenPOS - Paketler'
    else if (pathname.startsWith('/kermes')) document.title = 'PenPOS - Kermes'
    else document.title = 'PenPOS'
  }, [pathname])

  const IconHome = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H10v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M4 21v-1a7 7 0 0 1 14 0v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19.5 14.5l1 1.7-1 1.7-2-.3-.8 1.9-1.8-1.1-1.8 1.1-.8-1.9-2 .3-1-1.7 1-1.7 2 .3.8-1.9 1.8 1.1 1.8-1.1.8 1.9 2-.3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
  )
  const IconLogin = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5M3 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )

  const items = []
  if (!user) {
    items.push({ path: '/', label: 'Giris', icon: IconLogin, show: true })
  } else if (user.role === 'superadmin') {
    items.push({ path: '/superadmin/tenants', label: 'Uyeler', icon: IconTenant, show: true })
    items.push({ path: '/platform/kermes-tenants', label: 'Kermes Uyeler', icon: IconStore, show: true })
    items.push({ path: '/platform/canteen-tenants', label: 'Kantin Uyeler', icon: IconBuilding, show: true })
    items.push({ path: '/platform/plans', label: 'Paketler', icon: IconLayers, show: true })
    items.push({ path: '/platform/payments', label: 'Odeme Talepleri', icon: IconCreditCard, show: true })
    items.push({ path: '/platform/settings/me', label: 'Hesabim', icon: IconUserCog, show: true })
  } else if (user.role === 'platform_admin') {
    items.push({ path: '/platform/kermes-tenants', label: 'Kermes Uyeler', icon: IconStore, show: true })
    items.push({ path: '/platform/canteen-tenants', label: 'Kantin Uyeler', icon: IconBuilding, show: true })
    items.push({ path: '/platform/plans', label: 'Paketler', icon: IconLayers, show: true })
    items.push({ path: '/platform/payments', label: 'Odeme Talepleri', icon: IconCreditCard, show: true })
    items.push({ path: '/platform/settings/me', label: 'Hesabim', icon: IconUserCog, show: true })
  } else {
    const isExpired = tenantCtx?.tenant?.plan?.status === 'expired'
    const perms = Array.isArray(user?.permissions) ? user.permissions : []
    const canSettings = user.role === 'tenant_admin' || perms.includes('manage_settings') || perms.includes('manage_menu')

    if (user.role === 'tenant_admin' || perms.includes('reports_dashboard_view')) {
      items.push({ path: '/kermes/app/dashboard', label: 'Anasayfa', icon: IconHome, show: true })
      items.push({ path: '/kermes/app/reports', label: 'Raporlar', icon: IconFileCheck, show: true })
    }
    if (user.role === 'tenant_admin' || perms.includes('manage_tables')) {
      items.push({ path: '/kermes/app/tables', label: 'Masalar', icon: IconTableRestaurant, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('kitchen_access'))) {
      items.push({ path: '/kermes/app/kitchen', label: 'Hazirlanacaklar', icon: IconUtensils, show: true })
      items.push({ path: '/kermes/app/kitchen/bulk', label: 'Toplu Hazirlama', icon: IconUtensils, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('walkin_access')))) {
      items.push({ path: '/kermes/app/walkin', label: 'Masasiz Satis', icon: IconShoppingCart, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('view_delivery')))) {
      items.push({ path: '/kermes/app/delivery', label: 'Paket Servis', icon: IconTruck, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('closed_tables_page_view'))) {
      items.push({ path: '/kermes/app/reports/sales', label: 'Kapanan Masalar', icon: IconFileCheck, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('view_accounts') || perms.includes('manage_accounts'))) {
      items.push({ path: '/kermes/app/accounts', label: 'Cari Hesaplar', icon: IconWallet, show: true })
    }
    if (canSettings) {
      items.push({ path: '/kermes/settings', label: 'Ayarlar', icon: IconSettings, show: true })
    }
    if (user.role === 'tenant_admin' || perms.includes('audit_view')) {
      items.push({ path: '/kermes/app/audit', label: 'Denetim', icon: IconShieldCheck, show: true })
    }
  }

  const navItems = useMemo(() => {
    return items
      .filter((item) => item.show !== false)
      .map((item) => ({
        to: item.path,
        label: item.label,
        icon: item.icon,
        active: pathname === item.path || (item.path !== '/kermes/app/kitchen' && pathname.startsWith(item.path + '/'))
      }))
  }, [pathname, items])

  const current = navItems
    .filter((item) => item.active)
    .sort((a, b) => String(b.to || '').length - String(a.to || '').length)[0]

  const gridCols = isMobilePortrait
    ? '1fr'
    : (desktopCollapsed ? `${isTablet ? 64 : 56}px 1fr` : '220px 1fr')

  return (
    <div className="app" style={{ gridTemplateColumns: gridCols, gridTemplateRows: '56px 1fr' }}>
      <BranchSelectorModal />
      <MobileTopSheetNav
        open={isMobilePortrait && mobileMenuOpen}
        title="Menu"
        items={navItems}
        onClose={() => setMobileMenuOpen(false)}
        onSelect={(item) => {
          if (!item?.to) return
          nav(item.to)
        }}
      />
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="hamburger-btn"
            style={{ width: 36, height: 28, display: 'grid', placeItems: 'center' }}
            aria-label="Menu"
            onClick={() => {
              if (isMobilePortrait) setMobileMenuOpen((value) => !value)
              else setDesktopCollapsed((value) => !value)
            }}
          >
            ☰
          </button>
          <div
            style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center' }}
            aria-label="PenPOS"
          >
            <img src="/penpos%20logo.png" alt="PenPOS" style={{ height: 28, pointerEvents: 'none' }} onError={(e) => { e.currentTarget.src = '/penpos-logo.png' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
          {current && <span className="page-pill">{current.label}</span>}
          {!user && 'Giris Yap'}
        </div>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {user && <button className="btn" onClick={logout}>Cikis</button>}
          </div>
        </div>
      </header>
      {!isMobilePortrait && (
        <aside className={desktopCollapsed ? 'sidebar icon-rail' : 'sidebar'}>
          <nav style={{ display: 'grid', gap: 8 }}>
            {navItems.map((item) => {
              const Icon = item.icon
              const active = !!item.active
              return (
                <button
                  key={item.to}
                  type="button"
                  className={active ? 'active nav-link' : 'nav-link'}
                  onClick={() => nav(item.to)}
                  style={{ justifyContent: desktopCollapsed ? 'center' : 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span className="nav-icon">{Icon ? <Icon size={18} /> : null}</span>
                  {!desktopCollapsed && <span className="nav-label">{item.label}</span>}
                </button>
              )
            })}
          </nav>
        </aside>
      )}
      <main className="main"><Outlet /></main>
    </div>
  )
}
