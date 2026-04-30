import React, { useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Users as IconTenant } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import BranchSelectorModal from './BranchSelectorModal.jsx'
import MobileTopSheetNav from './MobileTopSheetNav.jsx'
import { useTheme } from '../theme/ThemeContext.jsx'
import { useAppDate } from '../context/AppDateContext.jsx'

const todayYmd = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Layout() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { user, logout, tenantCtx } = useAuth()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const { themeKey, theme } = useTheme()
  const { selectedDate, setSelectedDate } = useAppDate()
  const dateInputRef = useRef(null)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (pathname === '/kermes/app/dashboard') return
    const today = todayYmd()
    if (selectedDate !== today) setSelectedDate(today)
  }, [pathname, selectedDate, setSelectedDate])

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
        active: pathname === item.path
          || (item.path === '/kermes/app/tables' && pathname === '/kermes/app/pos')
          || (item.path !== '/kermes/app/kitchen' && pathname.startsWith(item.path + '/'))
      }))
  }, [pathname, items])

  const current = navItems
    .filter((item) => item.active)
    .sort((a, b) => String(b.to || '').length - String(a.to || '').length)[0]

  const activeIndex = navItems.findIndex((item) => item.to === current?.to)
  const accountLabel = String(user?.name || user?.fullName || user?.username || user?.email || 'Kullanici').trim()
  const pageTitle = pathname === '/kermes/app/pos'
    ? (String(location.state?.tableName || '').trim() || current?.label || 'Masalar')
    : (current?.label || 'Panel')
  const isDashboardPage = pathname === '/kermes/app/dashboard'
  const isReportsPage = pathname === '/kermes/app/reports'
  const isMonoTheme = themeKey === 'mono'
  const topbarDate = useMemo(() => {
    const value = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date()
    return value.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }, [selectedDate])

  const sidebarWidth = desktopCollapsed ? 94 : 228
  const navButtonWidth = desktopCollapsed ? 58 : 188
  const navItemHeight = desktopCollapsed ? 42 : 44
  const navItemGap = 6
  const navStep = navItemHeight + navItemGap

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#eef1f7', color: '#0f172a' }}>
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
      <div style={{ display: 'flex', height: '100%', alignItems: 'stretch', gap: 12, padding: isMobilePortrait ? 12 : 16, overflow: 'hidden' }}>
        {!isMobilePortrait && (
          <aside
            style={{
              position: 'relative',
              zIndex: 20,
              height: '100%',
              flexShrink: 0,
              width: sidebarWidth,
              overflow: 'hidden',
              borderRadius: 34,
              background: theme.sidebar,
              padding: 12,
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                marginBottom: 12,
                width: '100%',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <div
                onClick={() => setDesktopCollapsed((value) => !value)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setDesktopCollapsed((value) => !value)
                  }
                }}
                style={{
                  width: desktopCollapsed ? 64 : 140,
                  height: 64,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 22,
                  background: '#ffffff',
                  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.16)',
                  cursor: 'pointer',
                  transition: 'width 500ms ease'
                }}
                aria-label="Sidebari Ac Kapat"
              >
                <img
                  src={desktopCollapsed ? '/logo-1.png' : '/logo-2.png'}
                  alt="PenPOS"
                  style={{
                    width: desktopCollapsed ? 36 : 110,
                    height: desktopCollapsed ? 36 : 40,
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    display: 'block'
                  }}
                  onError={(e) => { e.currentTarget.src = '/penpos%20logo.png' }}
                />
              </div>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' }}>
            <nav style={{ position: 'relative', minHeight: 0, flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingLeft: 4, paddingRight: 4, paddingTop: 16, paddingBottom: 24 }}>
              <div style={{ position: 'relative', width: navButtonWidth, marginLeft: 'auto', marginRight: desktopCollapsed ? 'auto' : 0, display: 'grid', gap: navItemGap, paddingTop: 2 }}>
                {activeIndex >= 0 && (
                  <div
                    style={{
                      pointerEvents: 'none',
                      position: 'absolute',
                      left: 0,
                      top: 2,
                      zIndex: 0,
                      height: navItemHeight,
                      width: navButtonWidth,
                      borderRadius: 22,
                      background: 'rgba(255,255,255,0.95)',
                      boxShadow: theme.activeGlow,
                      transition: 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms ease',
                      transform: `translateY(${activeIndex * navStep}px)`,
                      border: '1px solid rgba(255,255,255,0.6)'
                    }}
                  />
                )}

                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = item.to === current?.to

                  return (
                    <button
                    className="sidebar-menu-button"
                    key={item.to}
                    type="button"
                    onClick={() => {
                      nav(item.to)
                      if (!desktopCollapsed) setDesktopCollapsed(true)
                    }}
                    title={item.label}
                    style={{
                        position: 'relative',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        height: navItemHeight,
                        width: navButtonWidth,
                        justifyContent: desktopCollapsed ? 'center' : 'flex-start',
                        gap: desktopCollapsed ? 0 : 8,
                        padding: desktopCollapsed ? 0 : '0 12px',
                        borderRadius: 22,
                        border: 'none',
                        background: 'transparent',
                        color: active ? '#0f172a' : (isMonoTheme ? '#334155' : 'rgba(255,255,255,0.78)'),
                        transition: 'all 300ms ease'
                      }}
                    >
                      {!active && (
                        <span
                          className="sidebar-menu-hover"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 22,
                            pointerEvents: 'none'
                          }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: desktopCollapsed ? 0 : 8 }}>
                        <span
                          style={{
                            position: 'relative',
                            zIndex: 10,
                            display: 'grid',
                            width: desktopCollapsed ? 32 : 34,
                            height: desktopCollapsed ? 32 : 34,
                            placeItems: 'center',
                            borderRadius: 15,
                            background: active ? theme.accent : (isMonoTheme ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)'),
                            color: active ? '#ffffff' : (isMonoTheme ? '#0f172a' : '#ffffff'),
                            boxShadow: active ? theme.activeGlow : 'none',
                            transform: active ? 'scale(1.05)' : 'scale(1)'
                          }}
                        >
                          {Icon ? <Icon size={13} /> : null}
                        </span>

                        {!desktopCollapsed && (
                          <span style={{ position: 'relative', zIndex: 10, fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </nav>
            <div style={{ marginTop: 'auto', paddingTop: 10, display: 'grid', gap: 6, justifyItems: desktopCollapsed ? 'center' : 'end' }}>
              {!desktopCollapsed && (
                <div style={{ width: navButtonWidth, color: 'rgba(255,255,255,0.72)', fontSize: 11.5, fontWeight: 800, padding: '0 6px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {accountLabel}
                </div>
              )}
              <button
                className="sidebar-menu-button"
                type="button"
                onClick={logout}
                style={{
                  width: navButtonWidth,
                  height: navItemHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: desktopCollapsed ? 'center' : 'flex-start',
                  gap: desktopCollapsed ? 0 : 8,
                  padding: desktopCollapsed ? 0 : '0 12px',
                  borderRadius: 22,
                  border: 'none',
                  background: desktopCollapsed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)',
                  color: desktopCollapsed ? '#ffffff' : '#0f172a',
                  cursor: 'pointer',
                  fontWeight: 900
                }}
                title="Cikis"
              >
                <span
                  className="sidebar-menu-hover"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 22,
                    pointerEvents: 'none'
                  }}
                />
                <span style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: desktopCollapsed ? 0 : 8 }}>
                  <span
                    style={{
                      display: 'grid',
                      width: desktopCollapsed ? 32 : 34,
                      height: desktopCollapsed ? 32 : 34,
                      placeItems: 'center',
                      borderRadius: 15,
                      background: desktopCollapsed ? 'rgba(255,255,255,0.08)' : theme.accent,
                      color: desktopCollapsed ? '#ffffff' : '#ffffff'
                    }}
                  >
                    <IconLogin size={13} />
                  </span>
                  {!desktopCollapsed && <span>Cikis</span>}
                </span>
              </button>
            </div>
            </div>
          </aside>
        )}

        <main style={{ position: 'relative', zIndex: 10, minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 34, background: '#ffffff', padding: isMobilePortrait ? 14 : 18, boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)' }}>
          <header
            className="topbar"
            style={{
              marginBottom: 16,
              background: 'transparent',
              borderBottom: 'none',
              boxShadow: 'none',
              padding: 0,
              flexShrink: 0,
              position: 'static'
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                padding: isMobilePortrait ? '16px 18px' : '18px 22px',
                borderRadius: 34,
                background: theme.topbar,
                border: `1px solid ${theme.border}`,
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isMobilePortrait && (
                  <button
                    className="hamburger-btn"
                    style={{ width: 40, height: 36, display: 'grid', placeItems: 'center', borderRadius: 14 }}
                    aria-label="Menu"
                    onClick={() => setMobileMenuOpen((value) => !value)}
                  >
                    ≡
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 900, color: theme.text, fontSize: isMobilePortrait ? 18 : 26 }}>
                  <span>{pageTitle}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    if (!isDashboardPage) return
                    const input = dateInputRef.current
                    if (!input) return
                    if (typeof input.showPicker === 'function') {
                      input.showPicker()
                      return
                    }
                    input.focus()
                    input.click()
                  }}
                  style={{ position: 'relative', borderRadius: 16, background: '#ffffff', fontWeight: 800, overflow: 'hidden', cursor: isDashboardPage ? 'pointer' : 'default' }}
                >
                  {topbarDate}
                  {isDashboardPage && (
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        right: 0,
                        bottom: 0,
                        opacity: 0,
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </button>

                {isReportsPage && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      try {
                        window.dispatchEvent(new CustomEvent('reports:export-request'))
                      } catch {}
                    }}
                    style={{
                      borderRadius: 16,
                      background: theme.accent,
                      borderColor: theme.accent,
                      color: '#ffffff',
                      fontWeight: 900,
                      boxShadow: theme.activeGlow
                    }}
                  >
                    Rapor Indir
                  </button>
                )}
              </div>
            </div>
          </header>

          <section style={{ minHeight: 0, flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: isMobilePortrait ? 0 : 2 }}>
            <div style={{ minWidth: 0, minHeight: '100%' }}>
              <div className="main" style={{ minHeight: '100%', padding: 0 }}>
                <Outlet />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
