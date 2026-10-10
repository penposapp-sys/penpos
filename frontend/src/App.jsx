import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SignIn from './pages/SignIn.jsx'
import PlatformLogin from './pages/PlatformLogin.jsx'
import LandingPage from './pages/LandingPage.jsx'
import SeoLandingPage from './pages/SeoLandingPage.jsx'
import LoginSelectionPage from './pages/LoginSelectionPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import SuperadminTenants from './pages/SuperadminTenants.jsx'
import SuperadminWebsiteSettings from './pages/SuperadminWebsiteSettings.jsx'
import PlatformAdminTenants from './pages/PlatformAdminTenants.jsx'
import PlatformAdminPlans from './pages/PlatformAdminPlans.jsx'
import PlatformAdminMembershipRequests from './pages/PlatformAdminMembershipRequests.jsx'
import PlatformAdminAnaokuluRegionAdmins from './pages/PlatformAdminAnaokuluRegionAdmins.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { useTheme } from './theme/ThemeContext.jsx'
import { useGlobalTypography } from './context/GlobalTypographyContext.jsx'
import { api } from './lib/apiClient.js'
import { toast } from './lib/toast.js'
import { confirmUnsavedAppearanceChanges, hasUnsavedAppearanceChanges } from './lib/unsavedAppearanceChanges.js'
import TenantUsageHeartbeat from './components/TenantUsageHeartbeat.jsx'
import { BusinessSettingsProvider } from './context/BusinessSettingsContext.jsx'
import StaffPage from './pages/StaffPage.jsx'
import SettingsPage, { SettingsTablesContent, SettingsPaymentsContent, SettingsSystemContent } from './pages/SettingsPage.jsx'
import SettingsMePage from './pages/SettingsMePage.jsx'
import UserAppearancePage from './pages/UserAppearancePage.jsx'
import SettingsDeliveryPage from './pages/SettingsDeliveryPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import MenuItemsPage from './pages/MenuItemsPage.jsx'
import ProductItemSettingsPage from './pages/ProductItemSettingsPage.jsx'
import PosPage from './pages/PosPage.jsx'
import WalkInPosPage from './pages/WalkInPosPage.jsx'
import DeliveryOrdersPage from './pages/DeliveryOrdersPage.jsx'
import DeliveryOrderDetailPage from './pages/DeliveryOrderDetailPage.jsx'
import PackageCourierPage from './pages/PackageCourierPage.jsx'
import KitchenPage from './pages/KitchenPage.jsx'
import KitchenBulkPage from './pages/KitchenBulkPage.jsx'
import ReportsSales from './pages/ReportsSales.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import _ProductReportPage from './pages/ProductReportPage.jsx'
import TablesPage from './pages/TablesPage.jsx'
import WaiterCallsPage from './pages/WaiterCallsPage.jsx'
import ReceiptPage from './pages/ReceiptPage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import BranchesPage from './pages/BranchesPage.jsx'
import UpgradePlan from './pages/UpgradePlan.jsx'
import Toast from './components/Toast.jsx'
import AccountsPage from './pages/AccountsPage.jsx'
import AccountDetailPage from './pages/AccountDetailPage.jsx'
import PublicMenuPage from './pages/PublicMenuPage.jsx'
import DigitalMenuPage from './pages/DigitalMenuPage.tsx'
import QrMenuSettingsPage from './pages/QrMenuSettingsPage.jsx'
import OnlineSalesSettingsPage from './pages/OnlineSalesSettingsPage.jsx'
import OnlineSalesPage from './pages/OnlineSalesPage.jsx'
import AnaokuluLogin from './pages/AnaokuluLogin.jsx'
import AnaokuluLayout from './anaokulu/layout/AnaokuluLayout.jsx'
import DashboardPage from './anaokulu/pages/DashboardOverviewPage.jsx'
import OgrencilerPage from './anaokulu/pages/OgrencilerPage.jsx'
import UcretPlaniPage from './anaokulu/pages/UcretPlaniPage.jsx'
import TahsilatlarPage from './anaokulu/pages/TahsilatlarPage.jsx'
import FaturalarPage from './anaokulu/pages/FaturalarPage.jsx'
import RaporlarPage from './anaokulu/pages/RaporlarPage.jsx'
import AyarlarPage from './anaokulu/pages/AyarlarPage.jsx'
import AnaokuluUyelerPage from './anaokulu/pages/AnaokuluUyelerPage.jsx'
import RegionAdminOkullarimPage from './anaokulu/pages/RegionAdminOkullarimPage.jsx'
import { AnaokuluDataProvider } from './anaokulu/context/AnaokuluDataContext.jsx'
import RestaurantWebsiteSettingsPage from './pages/RestaurantWebsiteSettingsPage.jsx'
import RestaurantWebsitePage from './pages/RestaurantWebsitePage.jsx'
import NotFound from './pages/NotFound.jsx'
import PrintingSettingsPage from './pages/PrintingSettingsPage.jsx'
import PrintStationPage from './pages/PrintStationPage.jsx'
import { hasAuthToken } from './lib/authStorage.js'
import NativePushBridge from './components/NativePushBridge.jsx'

import CanteenLayout from './canteen/layout/CanteenLayout.jsx'
import CanteenLogin from './canteen/pages/CanteenLogin.jsx'
import CanteenCashierPage from './canteen/pages/CanteenCashierPage.jsx'
import CanteenCustomersPage from './canteen/pages/CanteenCustomersPage.jsx'
import CanteenCustomerDetailPage from './canteen/pages/CanteenCustomerDetailPage.jsx'
import CanteenSalesPage from './canteen/pages/CanteenSalesPage.jsx'
import CanteenReportsPage from './canteen/pages/CanteenReportsPage.jsx'
import CanteenStockPage from './canteen/pages/CanteenStockPage.jsx'
import CanteenSettingsLayout from './canteen/pages/CanteenSettingsLayout.jsx'
import CanteenSettingsSystemPage from './canteen/pages/CanteenSettingsSystemPage.jsx'
import CanteenSettingsStaffPage from './canteen/pages/CanteenSettingsStaffPage.jsx'
import CanteenSettingsProductsPage from './canteen/pages/CanteenSettingsProductsPage.jsx'
import CanteenSettingsPaymentsPage from './canteen/pages/CanteenSettingsPaymentsPage.jsx'
import CanteenSettingsBillingPage from './canteen/pages/CanteenSettingsBillingPage.jsx'
import CanteenPrintingSettingsPage from './canteen/pages/CanteenPrintingSettingsPage.jsx'
import CanteenPrintStationPage from './canteen/pages/CanteenPrintStationPage.jsx'
import CanteenSettingsQrPage from './canteen/pages/CanteenSettingsQrPage.jsx'
import CanteenQrPricePage from './canteen/pages/CanteenQrPricePage.jsx'
import CanteenQrOrdersPage from './canteen/pages/CanteenQrOrdersPage.jsx'
import { getSubscriptionProfilePath, getSubscriptionUpgradePath, isSubscriptionExpired } from './lib/subscription.js'

const ProductReportPage = _ProductReportPage

const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

const resolveBackFallbackPath = (pathname) => {
  const path = String(pathname || '')

  if (path.startsWith('/restoran/app/pos/orders/')) return '/restoran/app/pos'
  if (path.startsWith('/restoran/app/walkin/')) return '/restoran/app/walkin'
  if (path.startsWith('/restoran/app/delivery/')) return '/restoran/app/delivery'
  if (path.startsWith('/restoran/app/package-courier')) return '/restoran'
  if (path.startsWith('/restoran/app/pos')) return '/restoran'
  if (path.startsWith('/restoran/app/walkin')) return '/restoran'
  if (path.startsWith('/restoran/app/delivery')) return '/restoran'
  if (path.startsWith('/restoran/app/')) return '/restoran'
  if (path.startsWith('/restoran/settings')) return '/restoran'

  if (path.startsWith('/magaza/cariler/')) return '/magaza/cariler'
  if (path.startsWith('/magaza/yapilan-satislar/')) return '/magaza/yapilan-satislar'
  if (path.startsWith('/magaza/ayarlar/') && path !== '/magaza/ayarlar') return '/magaza/ayarlar'
  if (path.startsWith('/magaza/qr-siparisleri/') && path !== '/magaza/qr-siparisleri') return '/magaza/qr-siparisleri'
  if (path.startsWith('/magaza/stok/') && path !== '/magaza/stok') return '/magaza/stok'
  if (path.startsWith('/magaza/raporlar/') && path !== '/magaza/raporlar') return '/magaza/raporlar'

  if (path.startsWith('/anaokulu/ogrenciler/')) return '/anaokulu/ogrenciler'
  if (path.startsWith('/anaokulu/tahsilatlar/')) return '/anaokulu/tahsilatlar'
  if (path.startsWith('/anaokulu/faturalar/')) return '/anaokulu/faturalar'
  if (path.startsWith('/anaokulu/ayarlar/') && path !== '/anaokulu/ayarlar' && path !== '/anaokulu/ayarlar/uyeler') return '/anaokulu/ayarlar'
  if (path.startsWith('/anaokulu/')) return '/anaokulu'

  if (path.startsWith('/platform')) return '/platform/restoran-tenants'
  if (path.startsWith('/superadmin')) return '/superadmin/tenants'

  return null
}

const buildRouteSnapshot = (location) => {
  const pathname = String(location?.pathname || '')
  const search = String(location?.search || '')
  const hash = String(location?.hash || '')
  return `${pathname}${search}${hash}`
}

const hasAnyAuthToken = () => (
  hasAuthToken('token_restaurant') ||
  hasAuthToken('token_canteen') ||
  hasAuthToken('token_platform') ||
  hasAuthToken('token_anaokulu')
)

const resolveHomePath = (user) => {
  if (!user) return null
  if (user.role === 'superadmin') return '/superadmin/tenants'
  if (user.role === 'platform_admin') return '/platform'
  if (user.role === 'anaokulu_region_admin') return '/anaokulu'
  if (user.systemType === 'canteen' || user.systemType === 'kantin') return '/magaza'
  if (user.systemType === 'anaokulu') return '/anaokulu'
  return '/restoran'
}

function LegacyFrontendUrlRedirect() {
  const location = useLocation()
  const pathname = String(location.pathname || '')
  const search = String(location.search || '')
  const hash = String(location.hash || '')

  if (pathname === '/login/kantin') return <Navigate to={`/login/magaza${search}${hash}`} replace />
  if (pathname === '/kermes' || pathname.startsWith('/kermes/')) {
    return <Navigate to={`/restoran${pathname.slice('/kermes'.length)}${search}${hash}`} replace />
  }
  return <Navigate to={`/magaza${pathname.slice('/canteen'.length)}${search}${hash}`} replace />
}

function CapacitorBackButtonHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, tenantCtx, loading } = useAuth()
  const routeStackRef = useRef([])
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)

  useEffect(() => {
    const nextEntry = buildRouteSnapshot(location)
    if (!nextEntry) return

    const currentStack = Array.isArray(routeStackRef.current) ? routeStackRef.current : []
    const lastEntry = currentStack.length > 0 ? currentStack[currentStack.length - 1] : ''
    if (lastEntry === nextEntry) return

    routeStackRef.current = [...currentStack, nextEntry].slice(-5)
  }, [location])

  useEffect(() => {
    if (!isNativeApp()) return undefined

    const handleAndroidBack = (event) => {
      if (exitConfirmOpen) {
        setExitConfirmOpen(false)
        return
      }

      if (event.detail?.action === 'confirmExit') {
        setExitConfirmOpen(true)
        return
      }

      const pathname = String(location.pathname || '')
      const currentRoute = buildRouteSnapshot(location)
      const hasToken = hasAnyAuthToken()
      const homePath = user ? resolveHomePath(user) : null

      const routeStack = Array.isArray(routeStackRef.current) ? [...routeStackRef.current] : []
      if (routeStack.length > 1) {
        const lastEntry = routeStack[routeStack.length - 1]
        if (lastEntry === currentRoute) routeStack.pop()
        let previousRoute = routeStack[routeStack.length - 1]
        while (previousRoute) {
          const previousPath = previousRoute.split(/[?#]/, 1)[0]
          if (
            previousPath !== '/' &&
            previousPath !== '/landing' &&
            previousPath !== homePath
          ) break
          routeStack.pop()
          previousRoute = routeStack[routeStack.length - 1]
        }
        if (previousRoute && previousRoute !== currentRoute) {
          routeStackRef.current = routeStack
          navigate(previousRoute, { replace: true })
          return
        }
        routeStackRef.current = routeStack
      }

      if (!user && hasToken) {
        if (loading) return
        if (pathname !== '/login') {
          navigate('/login', { replace: true })
        }
        return
      }

      const fallbackPath = resolveBackFallbackPath(pathname)
      if (fallbackPath && fallbackPath !== pathname) {
        navigate(fallbackPath, { replace: true })
        return
      }

      if (homePath && homePath !== pathname) {
        navigate(homePath, { replace: true })
        return
      }

      const defaultRoute = getDefaultRoute(user, tenantCtx)
      if (defaultRoute && defaultRoute !== pathname) {
        navigate(defaultRoute, { replace: true })
      }
    }

    window.addEventListener('penposAndroidBack', handleAndroidBack)
    return () => {
      window.removeEventListener('penposAndroidBack', handleAndroidBack)
    }
  }, [exitConfirmOpen, loading, location, navigate, tenantCtx, user])

  if (!exitConfirmOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="presentation"
      onClick={() => setExitConfirmOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(3, 8, 20, 0.72)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="native-exit-title"
        aria-describedby="native-exit-message"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 420px)',
          padding: 24,
          border: '1px solid rgba(148, 163, 184, 0.24)',
          borderRadius: 26,
          background: 'linear-gradient(145deg, #17233b, #0d1628)',
          color: '#f8fafc',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.48)',
        }}
      >
        <h2 id="native-exit-title" style={{ margin: 0, fontSize: 20, fontWeight: 850 }}>
          Uygulamadan çıkmak istiyor musunuz?
        </h2>
        <p id="native-exit-message" style={{ margin: '12px 0 24px', color: '#cbd5e1', lineHeight: 1.5 }}>
          PenPOS uygulaması kapatılacak.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={() => setExitConfirmOpen(false)}
            style={{
              minHeight: 44,
              padding: '0 18px',
              border: '1px solid #475569',
              borderRadius: 14,
              background: '#263449',
              color: '#e2e8f0',
              font: 'inherit',
              fontWeight: 750,
            }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => {
              setExitConfirmOpen(false)
              window.Capacitor?.Plugins?.App?.exitApp?.()
            }}
            style={{
              minHeight: 44,
              padding: '0 20px',
              border: 0,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #365fd6, #2446ad)',
              color: '#fff',
              font: 'inherit',
              fontWeight: 850,
              boxShadow: '0 8px 22px rgba(54, 95, 214, 0.3)',
            }}
          >
            Çıkış
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const getDefaultRoute = (user, tenantCtx) => {
  if (!user) return null
  if (user.role === 'superadmin') return '/superadmin/tenants'
  if (user.role === 'platform_admin') return '/platform/restoran-tenants'
  if (user.role === 'anaokulu_region_admin') return '/anaokulu/okullarim'

  const perms = Array.isArray(user.permissions) ? user.permissions : []
  const isExpired = isSubscriptionExpired(tenantCtx)
  const canSettings = user.role === 'tenant_admin' || perms.includes('manage_settings') || perms.includes('manage_menu')

  if (isExpired) {
    return user.role === 'tenant_admin'
      ? getSubscriptionUpgradePath(user.systemType)
      : getSubscriptionProfilePath(user.systemType)
  }

  if (user.systemType === 'canteen' || user.systemType === 'kantin') return '/magaza/kasa'
  if (user.systemType === 'anaokulu') return '/anaokulu/genel-bakis'

  if (user.role === 'tenant_admin' || perms.includes('reports_dashboard_view')) return '/restoran/app/dashboard'
  if (user.role === 'tenant_admin' || perms.includes('manage_tables')) return '/restoran/app/tables'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('kitchen_access'))) return '/restoran/app/kitchen'
  if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('walkin_access')))) return '/restoran/app/walkin'
  if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('view_delivery')))) return '/restoran/app/delivery'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('package_courier_page_view') || perms.includes('package_orders_view'))) return '/restoran/app/package-courier'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('closed_tables_page_view'))) return '/restoran/app/reports/sales'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('view_accounts') || perms.includes('manage_accounts'))) return '/restoran/app/accounts'
  if (canSettings) return '/restoran/settings'
  if (user.role === 'tenant_admin' || perms.includes('audit_view')) return '/restoran/app/audit'
  return null
}

const RootEntryRoute = () => {
  const { user, loading, tenantCtx } = useAuth()

  if (loading) {
    return null
  }

  const nextPath = getDefaultRoute(user, tenantCtx)
  if (nextPath) return <Navigate to={nextPath} replace />
  if (isNativeApp()) return <Navigate to="/login" replace />
  return <Navigate to="/landing" replace />
}

function NativeAppRouteGuard({ children }) {
  const location = useLocation()
  const { user, loading, tenantCtx } = useAuth()

  if (!isNativeApp()) return children

  const pathname = String(location.pathname || '')
  const isAppRoute = ['/restoran', '/magaza', '/anaokulu', '/platform', '/superadmin']
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  const isLoginFlowRoute = pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    [
      '/platform-login',
      '/anaokulu/login',
      '/magaza/login',
      '/forgot-password',
      '/reset-password',
      '/register',
    ].includes(pathname)

  if (isAppRoute || isLoginFlowRoute) return children
  if (loading) return null

  return <Navigate to={getDefaultRoute(user, tenantCtx) || '/login'} replace />
}

const KermesIndexRedirect = () => {
  const { user, loading, tenantCtx } = useAuth()
  if (loading) {
    return null
  }
  if (!user) return <Navigate to="/login" replace />

  const nextPath = getDefaultRoute(user, tenantCtx)
  if (nextPath) return <Navigate to={nextPath} replace />
  return <div className="card">Yetkili sayfa yok, yoneticinle gorus</div>
}

const AnaokuluIndexRoute = () => {
  const { user, regionCurrentTenantId, isRegionAdmin } = useAuth()
  if (isRegionAdmin || user?.role === 'anaokulu_region_admin' || user?.role === 'superadmin' || user?.role === 'platform_admin') {
    if (!regionCurrentTenantId) {
      return <Navigate to="/anaokulu/okullarim" replace />
    }
  }
  return <Navigate to="/anaokulu/genel-bakis" replace />
}

function AppearancePreferencesSync() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { setThemeKey, setDarkMode } = useTheme()
  const { resetPreference, setPreferenceValue } = useGlobalTypography()
  const userId = String(user?.id || user?._id || '')
  const loadedPreferencesRef = useRef({ userId: '', preferences: null })

  useEffect(() => {
    if (loading) return undefined
    let cancelled = false
    if (!userId) {
      loadedPreferencesRef.current = { userId: '', preferences: null }
      setThemeKey('white')
      setDarkMode(false)
      resetPreference()
      return undefined
    }

    const cached = loadedPreferencesRef.current
    if (cached.userId === userId && cached.preferences) {
      setThemeKey(cached.preferences.themeKey)
      setDarkMode(cached.preferences.darkMode)
      if (Number.isInteger(cached.preferences.fontSize)) setPreferenceValue(cached.preferences.fontSize)
      return undefined
    }

    const load = async () => {
      try {
        const response = await api('/api/user/preferences/appearance', { silent: true })
        if (cancelled) return
        if (!response?.ok || response?.success === false) {
          toast.error(response?.message || 'Kişisel görünüm tercihleri alınamadı.')
          return
        }
        const preferences = response.preferences || {}
        const resolvedPreferences = {
          themeKey: preferences.themeKey || 'white',
          darkMode: preferences.darkMode === true,
          fontSize: Number.isInteger(preferences.fontSize) ? preferences.fontSize : null,
        }
        loadedPreferencesRef.current = { userId, preferences: resolvedPreferences }
        setThemeKey(resolvedPreferences.themeKey)
        setDarkMode(resolvedPreferences.darkMode)
        if (Number.isInteger(resolvedPreferences.fontSize)) setPreferenceValue(resolvedPreferences.fontSize)
      } catch (error) {
        if (!cancelled) toast.error(error?.message || 'Kişisel görünüm tercihleri alınamadı.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [loading, location.pathname, resetPreference, setDarkMode, setPreferenceValue, setThemeKey, userId])

  useEffect(() => {
    const updateCachedPreferences = (event) => {
      if (!event.detail) return
      loadedPreferencesRef.current = { userId, preferences: event.detail }
    }
    window.addEventListener('appearance-preferences-updated', updateCachedPreferences)
    return () => window.removeEventListener('appearance-preferences-updated', updateCachedPreferences)
  }, [userId])

  return null
}

function UnsavedAppearanceNavigationGuard() {
  const location = useLocation()
  const restorePopRef = useRef(false)
  const historyIndexRef = useRef(Number(window.history.state?.idx ?? 0))

  useEffect(() => {
    historyIndexRef.current = Number(window.history.state?.idx ?? historyIndexRef.current)
  }, [location])

  useEffect(() => {
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState
    const guardHistoryChange = (originalMethod) => function guardedHistoryChange(state, title, url) {
      if (hasUnsavedAppearanceChanges()) {
        let destination
        try {
          destination = new URL(url == null ? window.location.href : String(url), window.location.href)
        } catch {
          destination = null
        }
        if (
          destination &&
          destination.origin === window.location.origin &&
          destination.href !== window.location.href &&
          !confirmUnsavedAppearanceChanges()
        ) return
      }
      return originalMethod.call(this, state, title, url)
    }
    const guardedPushState = guardHistoryChange(originalPushState)
    const guardedReplaceState = guardHistoryChange(originalReplaceState)
    window.history.pushState = guardedPushState
    window.history.replaceState = guardedReplaceState

    const onClick = (event) => {
      if (!hasUnsavedAppearanceChanges() || !(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]')
      if (!anchor || anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      let destination
      try {
        destination = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return
      if (!confirmUnsavedAppearanceChanges()) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
      }
    }

    const onBeforeUnload = (event) => {
      if (!hasUnsavedAppearanceChanges()) return
      event.preventDefault()
      event.returnValue = 'Kaydetmediğiniz değişiklikler iptal edilecektir. Devam etmek istiyor musunuz?'
    }

    const onPopState = (event) => {
      if (restorePopRef.current) {
        restorePopRef.current = false
        return
      }
      if (!hasUnsavedAppearanceChanges()) return
      if (confirmUnsavedAppearanceChanges()) return
      event.preventDefault()
      event.stopImmediatePropagation?.()
      const currentIndex = Number(window.history.state?.idx)
      const isBackNavigation = Number.isFinite(currentIndex) && currentIndex < historyIndexRef.current
      restorePopRef.current = true
      if (isBackNavigation) window.history.forward()
      else window.history.back()
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('popstate', onPopState, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPopState, true)
      if (window.history.pushState === guardedPushState) window.history.pushState = originalPushState
      if (window.history.replaceState === guardedReplaceState) window.history.replaceState = originalReplaceState
    }
  }, [])

  return null
}

export default function App() {
  return (
    <AuthProvider>
      <BusinessSettingsProvider>
        <AppearancePreferencesSync />
        <UnsavedAppearanceNavigationGuard />
        <CapacitorBackButtonHandler />
        <TenantUsageHeartbeat />
        <NativePushBridge />
        <Toast />
        <NativeAppRouteGuard>
        <Routes>
        <Route path="/" element={<RootEntryRoute />} />
        <Route path="/restoran-programi" element={<SeoLandingPage page="restoran-programi" />} />
        <Route path="/restoran-otomasyon-programi" element={<SeoLandingPage page="restoran-otomasyon-programi" />} />
        <Route path="/adisyon-programi" element={<SeoLandingPage page="adisyon-programi" />} />
        <Route path="/restoran-pos" element={<SeoLandingPage page="restoran-pos" />} />
        <Route path="/qr-menu-programi" element={<SeoLandingPage page="qr-menu-programi" />} />
        <Route path="/paket-servis-programi" element={<SeoLandingPage page="paket-servis-programi" />} />
        <Route path="/market-programi" element={<SeoLandingPage page="market-programi" />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginSelectionPage />} />
        <Route path="/platform-login" element={<PlatformLogin />} />
        <Route path="/platform/login" element={<Navigate to="/platform-login" replace />} />
        <Route path="/login/platform" element={<Navigate to="/platform-login" replace />} />
        <Route path="/login/restoran" element={<SignIn portal="restaurant" />} />
        <Route path="/login/kantin" element={<LegacyFrontendUrlRedirect />} />
        <Route path="/login/magaza" element={<Navigate to="/magaza/login" replace />} />
        <Route path="/login/anaokulu" element={<Navigate to="/anaokulu/login" replace />} />
        <Route path="/anaokulu/login" element={<AnaokuluLogin />} />
        <Route path="/kermes/*" element={<LegacyFrontendUrlRedirect />} />
        <Route path="/canteen/*" element={<LegacyFrontendUrlRedirect />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/menu/:tenantSlug" element={<PublicMenuPage />} />
        <Route path="/online/:tenantSlug" element={<OnlineSalesPage />} />
        <Route path="/online/:tenantSlug/:branchSlug" element={<OnlineSalesPage />} />
        <Route path="/weprestorant/:slug" element={<RestaurantWebsitePage siteType="restaurant" />} />
        <Route path="/wepmagaza/:slug" element={<RestaurantWebsitePage siteType="store" />} />
        <Route path="/website/:slug" element={<RestaurantWebsitePage />} />
        <Route path="/qr/:slug" element={<CanteenQrPricePage />} />
        <Route path="/qr-menu" element={<DigitalMenuPage />} />
        <Route path="/digital-menu" element={<DigitalMenuPage />} />
        <Route path="/magaza/login" element={<CanteenLogin />} />

        <Route path="/anaokulu" element={<AnaokuluDataProvider><ProtectedRoute roles={['tenant_admin', 'staff', 'anaokulu_region_admin', 'platform_admin', 'superadmin']} system="anaokulu"><AnaokuluLayout /></ProtectedRoute></AnaokuluDataProvider>}>
          <Route index element={<AnaokuluIndexRoute />} />
          <Route path="tercihlerim" element={<ProtectedRoute roles={['tenant_admin', 'staff', 'anaokulu_region_admin', 'platform_admin', 'superadmin']} system="anaokulu" allowExpired><UserAppearancePage /></ProtectedRoute>} />
          <Route path="genel-bakis" element={<DashboardPage />} />
          <Route path="ogrenciler" element={<OgrencilerPage />} />
          <Route path="ucret-taksit" element={<UcretPlaniPage />} />
          <Route path="tahsilatlar" element={<TahsilatlarPage />} />
          <Route path="faturalar" element={<FaturalarPage />} />
          <Route path="raporlar" element={<RaporlarPage />} />
          <Route path="ayarlar" element={<ProtectedRoute roles={['tenant_admin', 'staff', 'anaokulu_region_admin', 'platform_admin', 'superadmin']} system="anaokulu"><AyarlarPage /></ProtectedRoute>}>
            <Route path="uyeler" element={<ProtectedRoute roles={['tenant_admin', 'anaokulu_region_admin', 'platform_admin', 'superadmin']} system="anaokulu"><AnaokuluUyelerPage /></ProtectedRoute>} />
          </Route>
          <Route path="okullarim" element={<ProtectedRoute roles={['anaokulu_region_admin', 'platform_admin', 'superadmin']}><RegionAdminOkullarimPage /></ProtectedRoute>} />
        </Route>
        <Route path="/magaza" element={<CanteenLayout />}>
          <Route index element={<Navigate to="/magaza/kasa" replace />} />
          <Route path="tercihlerim" element={<ProtectedRoute roles={['tenant_admin', 'staff']} system="canteen" allowExpired><UserAppearancePage /></ProtectedRoute>} />
          <Route path="kasa" element={<CanteenCashierPage />} />
          <Route path="qr-siparisleri" element={<CanteenQrOrdersPage />} />
          <Route path="cariler" element={<CanteenCustomersPage />} />
          <Route path="cariler/:id" element={<CanteenCustomerDetailPage />} />
          <Route path="yapilan-satislar" element={<CanteenSalesPage />} />
          <Route path="raporlar" element={<CanteenReportsPage />} />
          <Route path="stok" element={<CanteenStockPage />} />
          <Route path="print-station" element={<CanteenPrintStationPage />} />
          <Route path="ayarlar" element={<CanteenSettingsLayout />}>
            <Route path="website" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings', 'manage_menu']} permissionsMode="any" system="canteen" allowExpired><RestaurantWebsiteSettingsPage systemType="canteen" /></ProtectedRoute>} />
            <Route path="me" element={<Navigate to="/magaza/ayarlar/sistem" replace />} />
            <Route path="sistem" element={<CanteenSettingsSystemPage />} />
            <Route path="subeler" element={<Navigate to="/magaza/ayarlar/sistem" replace />} />
            <Route path="personel" element={<CanteenSettingsStaffPage />} />
            <Route path="urunler" element={<CanteenSettingsProductsPage />} />
            <Route path="qr" element={<CanteenSettingsQrPage />} />
            <Route path="yazicilar" element={<CanteenPrintingSettingsPage />} />
            <Route path="yazıcılar" element={<CanteenPrintingSettingsPage />} />
            <Route path="odeme" element={<CanteenSettingsPaymentsPage />} />
            <Route path="ödeme" element={<CanteenSettingsPaymentsPage />} />
            <Route path="paket" element={<CanteenSettingsBillingPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Layout />}>
          <Route path="platform-admin" element={<Navigate to="/platform/restoran-tenants" replace />} />
          <Route path="platform" element={<Navigate to="/platform/restoran-tenants" replace />} />
          <Route path="platform/restoran-tenants" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminTenants key="kermes" system="kermes" /></ProtectedRoute>} />
          <Route path="platform/magaza-tenants" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminTenants key="canteen" system="canteen" /></ProtectedRoute>} />
          <Route path="platform/anaokulu-tenants" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminTenants key="anaokulu" system="anaokulu" /></ProtectedRoute>} />
          <Route path="platform/anaokulu-region-admins" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminAnaokuluRegionAdmins /></ProtectedRoute>} />
          <Route path="platform/plans" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminPlans /></ProtectedRoute>} />
          <Route path="platform/billing-requests" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminMembershipRequests /></ProtectedRoute>} />
          <Route path="platform/payments" element={<Navigate to="/platform/billing-requests" replace />} />
          <Route path="platform/settings/me" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><SettingsMePage apiBase="/api/platform" hideAppearance /></ProtectedRoute>} />
          <Route path="platform/tercihlerim" element={<ProtectedRoute roles={['platform_admin', 'superadmin']} allowExpired><UserAppearancePage /></ProtectedRoute>} />
          <Route path="superadmin/tenants" element={<ProtectedRoute roles={['superadmin']}><SuperadminTenants /></ProtectedRoute>} />
          <Route path="superadmin/website-settings" element={<ProtectedRoute roles={['superadmin']}><SuperadminWebsiteSettings /></ProtectedRoute>} />
        </Route>

        <Route path="/platform/tenants" element={<Navigate to="/platform/restoran-tenants" replace />} />
        <Route path="/platform-admin/restoran-tenants" element={<Navigate to="/platform/restoran-tenants" replace />} />
        <Route path="/platform-admin/anaokulu-region-admins" element={<Navigate to="/platform/anaokulu-region-admins" replace />} />
        <Route path="/platform-admin/plans" element={<Navigate to="/platform/plans" replace />} />
        <Route path="/platform-admin/billing-requests" element={<Navigate to="/platform/billing-requests" replace />} />
        <Route path="/platform-admin/payments" element={<Navigate to="/platform/billing-requests" replace />} />

        <Route path="/restoran" element={<Layout />}>
          <Route index element={<KermesIndexRedirect />} />
          <Route path="tercihlerim" element={<ProtectedRoute roles={['tenant_admin', 'staff']} system="kermes" allowExpired><UserAppearancePage /></ProtectedRoute>} />
          <Route path="app/dashboard" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><Dashboard /></ProtectedRoute>} />
          <Route path="app/tables" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_tables']} system="kermes"><TablesPage /></ProtectedRoute>} />
          <Route path="app/waiter-calls" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_tables']} system="kermes"><WaiterCallsPage /></ProtectedRoute>} />
          <Route path="app/kitchen" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['kitchen_access']} system="kermes"><KitchenPage /></ProtectedRoute>} />
          <Route path="app/kitchen/bulk" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['kitchen_access']} system="kermes"><KitchenBulkPage /></ProtectedRoute>} />
          <Route path="app/walkin" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'walkin_access']} system="kermes"><WalkInPosPage /></ProtectedRoute>} />
          <Route path="app/walkin/:orderId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'walkin_access']} system="kermes"><WalkInPosPage /></ProtectedRoute>} />
          <Route path="app/delivery" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'view_delivery']} system="kermes"><DeliveryOrdersPage /></ProtectedRoute>} />
          <Route path="app/delivery/:orderId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'view_delivery']} system="kermes"><DeliveryOrderDetailPage /></ProtectedRoute>} />
          <Route path="app/package-courier" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['package_courier_page_view', 'package_orders_view', 'manage_delivery', 'package_assign_courier']} permissionsMode="any" system="kermes"><PackageCourierPage /></ProtectedRoute>} />
          <Route path="app/reports" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><ReportsPage /></ProtectedRoute>} />
          <Route path="app/reports/sales" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['closed_tables_page_view']} system="kermes"><ReportsSales /></ProtectedRoute>} />
          <Route path="app/product-report" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><ProductReportPage /></ProtectedRoute>} />
          <Route path="app/accounts" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['view_accounts', 'manage_accounts']} permissionsMode="any" system="kermes"><AccountsPage /></ProtectedRoute>} />
          <Route path="app/accounts/:id" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['view_accounts', 'manage_accounts']} permissionsMode="any" system="kermes"><AccountDetailPage /></ProtectedRoute>} />
          <Route path="app/audit" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['audit_view']} system="kermes"><AuditPage /></ProtectedRoute>} />
          <Route path="app/pos" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access']} system="kermes"><PosPage /></ProtectedRoute>} />
          <Route path="app/pos/orders/:id/receipt" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access']} system="kermes"><ReceiptPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings', 'manage_menu']} permissionsMode="any" system="kermes" allowExpired><SettingsPage /></ProtectedRoute>}>
            <Route path="me" element={<Navigate to="/restoran/settings/system" replace />} />
            <Route path="system" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings', 'manage_menu']} permissionsMode="any" system="kermes"><SettingsSystemContent /></ProtectedRoute>} />
            <Route path="branches" element={<Navigate to="/restoran/settings/system" replace />} />
            <Route path="staff" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><StaffPage systemType="kermes" /></ProtectedRoute>} />
            <Route path="catalog" element={<Navigate to="/restoran/settings/catalog/items" replace />} />
            <Route path="catalog/categories" element={<Navigate to="/restoran/settings/catalog/items" replace />} />
            <Route path="catalog/items" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><MenuItemsPage /></ProtectedRoute>} />
            <Route path="catalog/items/:itemId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><ProductItemSettingsPage /></ProtectedRoute>} />
            <Route path="tables" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsTablesContent /></ProtectedRoute>} />
            <Route path="printers" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><PrintingSettingsPage system="kermes" /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsPaymentsContent /></ProtectedRoute>} />
            <Route path="delivery" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsDeliveryPage /></ProtectedRoute>} />
            <Route path="billing" element={<ProtectedRoute roles={['tenant_admin']} system="kermes" allowExpired><UpgradePlan /></ProtectedRoute>} />
            <Route path="qr" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><QrMenuSettingsPage /></ProtectedRoute>} />
            <Route path="online-sales" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><OnlineSalesSettingsPage /></ProtectedRoute>} />
            <Route path="website" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings', 'manage_menu']} permissionsMode="any" system="kermes" allowExpired><RestaurantWebsiteSettingsPage /></ProtectedRoute>} />
            <Route path="menü" element={<Navigate to="/restoran/settings/catalog" replace />} />
            <Route path="menu/categories" element={<Navigate to="/restoran/settings/catalog/items" replace />} />
            <Route path="menu/items" element={<Navigate to="/restoran/settings/catalog/items" replace />} />
            <Route path="qr-menü" element={<Navigate to="/restoran/settings/qr" replace />} />
          </Route>
          <Route path="print-station" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><PrintStationPage system="kermes" /></ProtectedRoute>} />
          <Route path="*" element={<KermesIndexRedirect />} />
        </Route>

        <Route path="/app/settings/*" element={<Navigate to="/restoran/settings/system" replace />} />
        <Route path="/app/*" element={<Navigate to="/restoran" replace />} />
        <Route path="/accounts" element={<Navigate to="/restoran/app/accounts" replace />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
        </NativeAppRouteGuard>
      </BusinessSettingsProvider>
    </AuthProvider>
  )
}
