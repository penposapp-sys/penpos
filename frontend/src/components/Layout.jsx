import React, { useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Globe2 as IconWebsite, Users as IconTenant } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import BranchSelectorModal from './BranchSelectorModal.jsx'
import MobileTopSheetNav from './MobileTopSheetNav.jsx'
import { useTheme } from '../theme/ThemeContext.jsx'
import { useAppDate } from '../context/AppDateContext.jsx'
import { useBusinessSettings } from '../context/BusinessSettingsContext.jsx'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { getSubscriptionProfilePath, getSubscriptionUpgradePath, isSubscriptionExpired } from '../lib/subscription.js'
import { api } from '../lib/apiClient.js'

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
  const { themeKey, theme, isMobileRuntime } = useTheme()
  const { getSetting } = useBusinessSettings()
  const { selectedDate, setSelectedDate } = useAppDate()
  const dateInputRef = useRef(null)
  const topbarRef = useRef(null)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [topbarHeight, setTopbarHeight] = useState(0)
  const [pendingOnlineCount, setPendingOnlineCount] = useState(0)

  useBodyLayoutMode('pos-app-layout')

  useEffect(() => {
    try { document.body.classList.add('app-shell-active') } catch {}
    return () => {
      try { document.body.classList.remove('app-shell-active') } catch {}
    }
  }, [])

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
    const handleToggleMobileMenu = () => {
      if (!isMobilePortrait) return
      setMobileMenuOpen((value) => !value)
    }
    window.addEventListener('layout:toggle-mobile-menu', handleToggleMobileMenu)
    return () => window.removeEventListener('layout:toggle-mobile-menu', handleToggleMobileMenu)
  }, [isMobilePortrait])

  useEffect(() => {
    const enabled = !!(isMobilePortrait && (
      pathname.startsWith('/kermes/app/pos') ||
      pathname.startsWith('/kermes/app/walkin') ||
      pathname.startsWith('/kermes/app/delivery') ||
      pathname.startsWith('/canteen/kasa')
    ))

    try {
      if (enabled) document.body.classList.add('sales-mobile-scroll')
      else document.body.classList.remove('sales-mobile-scroll')
      if (enabled) document.body.classList.add('mobile-sales-mode')
      else document.body.classList.remove('mobile-sales-mode')
    } catch {}

    return () => {
      try { document.body.classList.remove('sales-mobile-scroll') } catch {}
      try { document.body.classList.remove('mobile-sales-mode') } catch {}
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
    if (pathname.startsWith('/login/platform') || pathname.startsWith('/platform-login')) document.title = 'PenPOS - Platform Yönetimi Girişi'
    else if (pathname.startsWith('/login/restoran')) document.title = 'PenPOS - Restoran Girisi'
    else if (pathname.startsWith('/login/kantin')) document.title = 'PenPOS - Mağaza Girişi'
    else if (pathname === '/') document.title = 'PenPOS - Giris Secimi'
    else if (pathname.startsWith('/superadmin/website-settings')) document.title = 'PenPOS - Web Site Ayarlari'
    else if (pathname.startsWith('/superadmin/tenants')) document.title = 'PenPOS - Uyeler'
    else if (pathname.startsWith('/platform/billing-requests')) document.title = 'PenPOS - Uyelik Talepleri'
    else if (pathname.startsWith('/platform/kermes-tenants')) document.title = 'PenPOS - Kermes Uyeler'
    else if (pathname.startsWith('/platform/canteen-tenants')) document.title = 'PenPOS - Mağaza Üyeleri'
    else if (pathname.startsWith('/platform/plans')) document.title = 'PenPOS - Paketler'
    else if (pathname.startsWith('/kermes')) document.title = 'PenPOS - Kermes'
    else document.title = 'PenPOS'
  }, [pathname])

  useEffect(() => {
    const perms = Array.isArray(user?.permissions) ? user.permissions : []
    const canViewPackageOrders = Boolean(
      user
      && user.role !== 'platform_admin'
      && user.role !== 'superadmin'
      && (
        user.role === 'tenant_admin'
        || perms.includes('view_delivery')
        || perms.includes('manage_delivery')
        || perms.includes('package_orders_view')
        || perms.includes('package_courier_page_view')
      )
    )

    if (!canViewPackageOrders) {
      setPendingOnlineCount(0)
      return undefined
    }

    let cancelled = false
    const loadPendingCount = async () => {
      try {
        const res = await api('/api/pos/package-orders/online-pending-count', {
          silent: true,
          suppressBranchModal: true
        })
        if (!cancelled) setPendingOnlineCount(Math.max(0, Number(res?.count || 0)))
      } catch {
        if (!cancelled) setPendingOnlineCount(0)
      }
    }

    loadPendingCount()
    const timer = window.setInterval(loadPendingCount, 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user])

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
    items.push({ path: '/superadmin/website-settings', label: 'Web Site Ayarlari', icon: IconWebsite, show: true })
    items.push({ path: '/platform/kermes-tenants', label: 'Kermes Uyeler', icon: IconStore, show: true })
    items.push({ path: '/platform/canteen-tenants', label: 'Mağaza Üyeleri', icon: IconBuilding, show: true })
    items.push({ path: '/platform/plans', label: 'Paketler', icon: IconLayers, show: true })
    items.push({ path: '/platform/billing-requests', label: 'Uyelik Talepleri', icon: IconLayers, show: true })
    items.push({ path: '/platform/settings/me', label: 'Hesabim', icon: IconUserCog, show: true })
  } else if (user.role === 'platform_admin') {
    items.push({ path: '/platform/kermes-tenants', label: 'Kermes Uyeler', icon: IconStore, show: true })
    items.push({ path: '/platform/canteen-tenants', label: 'Mağaza Üyeleri', icon: IconBuilding, show: true })
    items.push({ path: '/platform/plans', label: 'Paketler', icon: IconLayers, show: true })
    items.push({ path: '/platform/billing-requests', label: 'Uyelik Talepleri', icon: IconLayers, show: true })
    items.push({ path: '/platform/settings/me', label: 'Hesabim', icon: IconUserCog, show: true })
  } else {
    const isExpired = isSubscriptionExpired(tenantCtx)
    const perms = Array.isArray(user?.permissions) ? user.permissions : []
    const canSettings = user.role === 'tenant_admin' || perms.includes('manage_settings') || perms.includes('manage_menu')
    const creditAccountsDisabled = getSetting('general.disableCreditAccounts', false) === true

    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('reports_dashboard_view'))) {
      items.push({ path: '/kermes/app/dashboard', label: 'Anasayfa', icon: IconHome, show: true })
      items.push({ path: '/kermes/app/reports', label: 'Raporlar', icon: IconFileCheck, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('manage_tables'))) {
      items.push({ path: '/kermes/app/tables', label: 'Masalar', icon: IconTableRestaurant, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('kitchen_access'))) {
      items.push({ path: '/kermes/app/kitchen', label: 'Hazirlanacaklar', icon: IconUtensils, show: true })
      items.push({ path: '/kermes/app/kitchen/bulk', label: 'Toplu Hazırlama', icon: IconUtensils, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('walkin_access')))) {
      items.push({ path: '/kermes/app/walkin', label: 'Masasız Satış', icon: IconShoppingCart, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('view_delivery')))) {
      items.push({ path: '/kermes/app/delivery', label: 'Paket Servis', icon: IconTruck, show: true, badgeCount: pendingOnlineCount })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('package_courier_page_view') || perms.includes('package_orders_view'))) {
      items.push({ path: '/kermes/app/package-courier', label: 'Paket Kurye', icon: IconTruck, show: true })
    }
    if (!creditAccountsDisabled && !isExpired && (user.role === 'tenant_admin' || perms.includes('view_accounts') || perms.includes('manage_accounts'))) {
      items.push({ path: '/kermes/app/accounts', label: 'Cari Hesaplar', icon: IconWallet, show: true })
    }
    if (isExpired) {
      if (user.role === 'tenant_admin') {
        items.push({ path: getSubscriptionUpgradePath(user.systemType), label: 'Paket Yükselt', icon: IconCreditCard, show: true })
      }
      items.push({ path: getSubscriptionProfilePath(user.systemType), label: 'Hesabım', icon: IconUserCog, show: true })
    } else if (canSettings) {
      items.push({ path: '/kermes/settings', label: 'Ayarlar', icon: IconSettings, show: true })
    }
    if (!isExpired && (user.role === 'tenant_admin' || perms.includes('audit_view'))) {
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
        badgeCount: Number(item.badgeCount || 0),
        active: pathname === item.path
          || (item.path === '/kermes/app/tables' && pathname === '/kermes/app/pos')
          || (item.path !== '/kermes/app/kitchen' && pathname.startsWith(item.path + '/'))
      }))
  }, [pathname, items])

  const current = navItems
    .filter((item) => item.active)
    .sort((a, b) => String(b.to || '').length - String(a.to || '').length)[0]

  const activeIndex = navItems.findIndex((item) => item.to === current?.to)
  const accountLabel = String(user?.name || user?.fullName || user?.username || user?.email || 'Kullanıcı').trim()
  const pageTitle = pathname === '/kermes/app/pos'
    ? (String(location.state?.tableName || '').trim() || current?.label || 'Masalar')
    : (current?.label || 'Panel')
  const isDashboardPage = pathname === '/kermes/app/dashboard'
  const isReportsPage = pathname === '/kermes/app/reports'
  const isSettingsRoute = pathname.startsWith('/kermes/settings')
  const isMobileSettingsRoute = isMobilePortrait && isSettingsRoute
  const isDesktopSalesRoute = !isMobilePortrait && (
    pathname.startsWith('/kermes/app/pos') ||
    pathname.startsWith('/kermes/app/walkin') ||
    pathname.startsWith('/kermes/app/delivery')
  )

  useEffect(() => {
    if (isMobilePortrait || !isDesktopSalesRoute) return undefined

    const updateDesktopCollapse = () => {
      const shouldCollapse = window.innerWidth <= 1500
      setDesktopCollapsed((prev) => (prev === shouldCollapse ? prev : shouldCollapse))
    }

    updateDesktopCollapse()
    window.addEventListener('resize', updateDesktopCollapse)
    return () => window.removeEventListener('resize', updateDesktopCollapse)
  }, [isDesktopSalesRoute, isMobilePortrait])

  useEffect(() => {
    if (isSettingsRoute || !topbarRef.current) {
      setTopbarHeight(0)
      return undefined
    }

    const node = topbarRef.current
    const updateHeight = () => {
      const rect = node.getBoundingClientRect()
      const computed = window.getComputedStyle(node)
      const marginBottom = Number.parseFloat(computed.marginBottom || '0') || 0
      setTopbarHeight(Math.ceil(rect.height + marginBottom))
    }

    updateHeight()

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateHeight())
      : null

    if (observer) observer.observe(node)
    window.addEventListener('resize', updateHeight)

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [isSettingsRoute, isMobilePortrait, pathname])
  const sidebarTextColor = 'var(--sidebar-item-text, var(--sidebar-nav-text, var(--app-text)))'
  const sidebarActiveTextColor = 'var(--sidebar-item-text-active, var(--sidebar-nav-text-active, var(--app-text)))'
  const sidebarIconColor = 'var(--sidebar-item-icon, var(--sidebar-nav-icon, var(--app-text)))'
  const sidebarActiveIconColor = 'var(--sidebar-item-icon-active, var(--sidebar-nav-icon-active, var(--theme-accent)))'
  const sidebarIconBg = 'var(--sidebar-item-icon-bg, var(--sidebar-nav-icon-bg, var(--app-surface)))'
  const sidebarActiveIconBg = 'var(--sidebar-item-icon-active-bg, var(--sidebar-nav-icon-active-bg, var(--app-surface-soft)))'
  const logoutIconBg = 'var(--sidebar-logout-icon-bg, var(--sidebar-item-icon-bg, var(--sidebar-nav-icon-bg, var(--app-surface))))'
  const logoutIconColor = 'var(--sidebar-logout-icon-color, var(--sidebar-item-icon, var(--sidebar-nav-icon, var(--app-text))))'
  const logoutTextColor = 'var(--sidebar-logout-text, var(--sidebar-item-text-active, var(--sidebar-nav-text-active, var(--app-text))))'
  const effectiveDarkMode = theme.darkMode
  const sidebarLogoSrc = desktopCollapsed
    ? '/logo-1.png'
    : (effectiveDarkMode ? '/logo-3.png' : '/logo-2.png')
  const topbarDate = useMemo(() => {
    const value = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date()
    return value.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }, [selectedDate])
  const topbarDateShort = useMemo(() => {
    const value = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date()
    return value.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short'
    })
  }, [selectedDate])

  const sidebarWidth = desktopCollapsed ? 94 : 228
  const navButtonWidth = desktopCollapsed ? 58 : 188
  const navItemHeight = desktopCollapsed ? 42 : 44
  const navItemGap = 6
  const navStep = navItemHeight + navItemGap
  const mobileShellPadding = isMobileSettingsRoute ? 4 : 8
  const mobileMainRadius = isMobileSettingsRoute ? 0 : 22
  const mobileMainPadding = isMobileSettingsRoute ? 0 : 8
  const mobileTopbarPadding = '12px 14px'
  const mobileContentInset = isMobileSettingsRoute ? 6 : 8

  return (
    <div className="pos-app-shell" style={{ background: 'transparent', color: 'var(--app-text, var(--text))' }}>
      <BranchSelectorModal />
      <MobileTopSheetNav
        open={isMobilePortrait && mobileMenuOpen}
        title="Menü"
        items={navItems}
        onClose={() => setMobileMenuOpen(false)}
        onSelect={(item) => {
          if (!item?.to) return
          setMobileMenuOpen(false)
          window.setTimeout(() => {
            nav(item.to)
          }, 0)
        }}
      />
      <div style={{ display: 'flex', height: '100%', minHeight: 0, alignItems: isMobilePortrait ? 'stretch' : 'flex-start', gap: isMobilePortrait ? 8 : (isSettingsRoute ? 10 : 12), padding: isMobilePortrait ? mobileShellPadding : (isSettingsRoute ? 12 : 16) }}>
        {!isMobilePortrait && (
          <aside
            className="pos-sidebar"
            style={{
              position: 'sticky',
              top: 16,
              zIndex: 20,
              alignSelf: 'flex-start',
              flexShrink: 0,
              width: sidebarWidth,
              height: 'calc(100dvh - 32px)',
              overflow: 'hidden',
              borderRadius: 36,
              background: 'var(--sidebar-bg)',
              padding: 12,
              border: '1px solid var(--border-soft)',
              backdropFilter: 'blur(24px)',
              boxShadow: 'var(--shadow-soft), var(--shadow-glow)',
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
                  borderRadius: 24,
                  border: '1px solid var(--sidebar-logo-border, var(--border-soft))',
                  background: 'var(--sidebar-logo-bg, var(--card-bg))',
                  backdropFilter: 'var(--glass-blur)',
                  boxShadow: 'var(--sidebar-active-shadow, var(--shadow-soft))',
                  cursor: 'pointer',
                  transition: 'width 500ms ease'
                }}
                aria-label="Sidebari Ac Kapat"
              >
                <img
                  src={sidebarLogoSrc}
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
                      borderRadius: 24,
                      background: 'var(--sidebar-active-bg, var(--menu-active-bg, var(--card-hover)))',
                      boxShadow: 'var(--sidebar-active-shadow, none)',
                      transition: 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms ease',
                      transform: `translateY(${activeIndex * navStep}px)`,
                      border: '1px solid var(--sidebar-active-border, var(--border-hover))',
                      backdropFilter: 'var(--glass-blur)'
                    }}
                  />
                )}

                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = item.to === current?.to
                  const hasBadge = Number(item.badgeCount || 0) > 0

                  return (
                    <Link
                    className="sidebar-menü-button"
                    key={item.to}
                    to={item.to}
                    onClick={(event) => {
                      if (
                        event.defaultPrevented
                        || event.button !== 0
                        || event.metaKey
                        || event.ctrlKey
                        || event.shiftKey
                        || event.altKey
                      ) return
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
                        borderRadius: 24,
                        border: 'none',
                        background: 'transparent',
                        color: active ? sidebarActiveTextColor : sidebarTextColor,
                        transition: 'all .25s ease',
                        textDecoration: 'none'
                      }}
                    >
                      {!active && (
                        <span
                          className="sidebar-menü-hover"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 22,
                            pointerEvents: 'none'
                          }}
                        />
                      )}
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: desktopCollapsed ? 0 : 8,
                          width: desktopCollapsed ? (hasBadge ? '100%' : 'auto') : '100%',
                          justifyContent: desktopCollapsed ? (hasBadge ? 'space-between' : 'center') : 'flex-start',
                          padding: desktopCollapsed && hasBadge ? '0 4px 0 0' : 0
                        }}
                      >
                        <span
                          style={{
                            position: 'relative',
                            zIndex: 10,
                            display: 'grid',
                            width: desktopCollapsed ? 32 : 34,
                            height: desktopCollapsed ? 32 : 34,
                            placeItems: 'center',
                            borderRadius: 16,
                            background: active ? sidebarActiveIconBg : sidebarIconBg,
                            color: active ? sidebarActiveIconColor : sidebarIconColor,
                            boxShadow: 'none',
                            transform: 'none'
                          }}
                        >
                          {Icon ? <Icon size={13} /> : null}
                        </span>

                        {!desktopCollapsed && (
                          <span style={{ position: 'relative', zIndex: 10, fontSize: 12, fontWeight: 900, color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        )}
                        {hasBadge && (
                          <span
                            style={{
                              position: 'relative',
                              zIndex: 10,
                              minWidth: 22,
                              height: 22,
                              padding: '0 7px',
                              borderRadius: 999,
                              background: '#ef4444',
                              color: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 900,
                              marginLeft: desktopCollapsed ? 6 : 'auto',
                              flexShrink: 0
                            }}
                          >
                            {item.badgeCount > 99 ? '99+' : item.badgeCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </nav>
            <div style={{ marginTop: 'auto', paddingTop: 10, display: 'grid', gap: 6, justifyItems: desktopCollapsed ? 'center' : 'end' }}>
              {!desktopCollapsed && (
                <div style={{ width: navButtonWidth, color: sidebarTextColor, fontSize: 11.5, fontWeight: 800, padding: '0 6px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {accountLabel}
                </div>
              )}
              <button
                className="sidebar-menü-button"
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
                  borderRadius: 24,
                  border: 'none',
                  background: 'var(--sidebar-logout-bg, var(--card-hover))',
                  color: desktopCollapsed ? sidebarTextColor : logoutTextColor,
                  cursor: 'pointer',
                  fontWeight: 900
                }}
                title="Çıkış"
              >
                <span
                  className="sidebar-menü-hover"
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
                      borderRadius: 16,
                      background: logoutIconBg,
                      color: logoutIconColor
                    }}
                  >
                    <IconLogin size={13} />
                  </span>
                  {!desktopCollapsed && <span>Çıkış</span>}
                </span>
              </button>
            </div>
            </div>
          </aside>
        )}

        <main className="pos-main" style={{ position: 'relative', zIndex: 10, minWidth: 0, minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: isMobilePortrait ? mobileMainRadius : (isSettingsRoute ? 30 : 36), background: isMobileSettingsRoute ? 'transparent' : 'var(--card-bg)', border: isMobileSettingsRoute ? '0' : '1px solid var(--border-soft)', backdropFilter: isMobileSettingsRoute ? 'none' : 'var(--glass-blur)', padding: isMobilePortrait ? mobileMainPadding : (isSettingsRoute ? 12 : 18), boxShadow: isMobileSettingsRoute ? 'none' : 'var(--shadow-soft), var(--shadow-glow)', maxWidth: '100%' }}>
          {!isSettingsRoute ? <header
            ref={topbarRef}
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
                flexWrap: isMobilePortrait ? 'nowrap' : 'wrap',
                padding: isMobilePortrait ? mobileTopbarPadding : '18px 22px',
                borderRadius: 999,
                background: theme.topbar,
                border: '1px solid var(--topbar-border)',
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--topbar-shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto' }}>
                {isMobilePortrait && (
                  <button
                    className="hamburger-btn"
                    style={{ width: 40, height: 36, display: 'grid', placeItems: 'center', borderRadius: 14 }}
                    aria-label="Menü"
                    onClick={() => setMobileMenuOpen((value) => !value)}
                  >
                    ≡
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, fontWeight: 900, color: theme.text, fontSize: isMobilePortrait ? 16 : 26 }}>
                  <span style={{ display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pageTitle}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', justifyContent: 'flex-end', flexShrink: 0, minWidth: 0 }}>
                <button
                  className="btn button-light"
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
                  style={{ position: 'relative', minWidth: 0, paddingInline: isMobilePortrait ? 10 : undefined, borderRadius: 999, background: 'var(--surface-glass)', color: 'var(--app-text, var(--text))', border: '1px solid var(--border-soft)', fontWeight: 800, overflow: 'hidden', cursor: isDashboardPage ? 'pointer' : 'default', backdropFilter: 'var(--glass-blur)' }}
                >
                  {isMobilePortrait ? topbarDateShort : topbarDate}
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

                {isMobilePortrait && user && (
                  <button
                    className="btn button-light"
                    type="button"
                    onClick={logout}
                    style={{
                      minHeight: 42,
                      borderRadius: 999,
                      paddingInline: 12,
                      background: 'var(--app-contrast-surface)',
                      borderColor: 'var(--app-contrast-border)',
                      color: 'var(--app-contrast-text)',
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 14px 32px rgba(0,0,0,0.18)'
                    }}
                  >
                    Çıkış
                  </button>
                )}

                {isReportsPage && (
                  <button
                    className="btn button-light"
                    type="button"
                    onClick={() => {
                      try {
                        window.dispatchEvent(new CustomEvent('reports:export-request'))
                      } catch {}
                    }}
                    style={{
                      minHeight: 42,
                      borderRadius: 999,
                      paddingInline: isMobilePortrait ? 12 : undefined,
                      background: 'var(--app-contrast-surface)',
                      borderColor: 'var(--app-contrast-border)',
                      color: 'var(--app-contrast-text)',
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 14px 32px rgba(0,0,0,0.18)'
                    }}
                  >
                    Rapor Indir
                  </button>
                )}
              </div>
            </div>
          </header> : null}

          <section
            className={`page-scroll page-scroll-area scrollbar-hidden${isDesktopSalesRoute ? ' sales-page-content-shell' : ''}`}
            style={{
              minHeight: 0,
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              paddingRight: isMobilePortrait ? 0 : 2,
              maxWidth: '100%',
              '--page-shell-header-height': `${topbarHeight}px`
            }}
          >
            <div className={`page-content${isDesktopSalesRoute ? ' sales-page-content' : ''}`} key={pathname} style={{ minWidth: 0, minHeight: '100%' }}>
              <div className={`main${isDesktopSalesRoute ? ' sales-page-main' : ''}`} style={{ padding: isMobilePortrait ? mobileContentInset : 0 }}>
                <Outlet />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
