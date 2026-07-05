import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SignIn from './pages/SignIn.jsx'
import PlatformLogin from './pages/PlatformLogin.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginSelectionPage from './pages/LoginSelectionPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import SuperadminTenants from './pages/SuperadminTenants.jsx'
import SuperadminWebsiteSettings from './pages/SuperadminWebsiteSettings.jsx'
import PlatformAdminTenants from './pages/PlatformAdminTenants.jsx'
import PlatformAdminPlans from './pages/PlatformAdminPlans.jsx'
import PlatformAdminMembershipRequests from './pages/PlatformAdminMembershipRequests.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { BusinessSettingsProvider } from './context/BusinessSettingsContext.jsx'
import StaffPage from './pages/StaffPage.jsx'
import SettingsPage, { SettingsTablesContent, SettingsPaymentsContent, SettingsSystemContent } from './pages/SettingsPage.jsx'
import SettingsMePage from './pages/SettingsMePage.jsx'
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
import NotFound from './pages/NotFound.jsx'
import PrintingSettingsPage from './pages/PrintingSettingsPage.jsx'
import PrintStationPage from './pages/PrintStationPage.jsx'
import { hasAuthToken } from './lib/authStorage.js'

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
import CanteenSettingsBranchesPage from './canteen/pages/CanteenSettingsBranchesPage.jsx'
import CanteenSettingsStaffPage from './canteen/pages/CanteenSettingsStaffPage.jsx'
import CanteenSettingsMePage from './canteen/pages/CanteenSettingsMePage.jsx'
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

const EXIT_ROUTES = new Set([
  '/',
  '/landing',
  '/login',
  '/login-selection',
  '/login/platform',
  '/platform-login',
  '/login/restoran',
  '/login/kantin',
  '/canteen/login',
])

const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

const resolveBackFallbackPath = (pathname) => {
  const path = String(pathname || '')

  if (path.startsWith('/kermes/app/pos/orders/')) return '/kermes/app/pos'
  if (path.startsWith('/kermes/app/walkin/')) return '/kermes/app/walkin'
  if (path.startsWith('/kermes/app/delivery/')) return '/kermes/app/delivery'
  if (path.startsWith('/kermes/app/package-courier')) return '/kermes'
  if (path.startsWith('/kermes/app/pos')) return '/kermes'
  if (path.startsWith('/kermes/app/walkin')) return '/kermes'
  if (path.startsWith('/kermes/app/delivery')) return '/kermes'
  if (path.startsWith('/kermes/app/')) return '/kermes'
  if (path.startsWith('/kermes/settings')) return '/kermes'

  if (path.startsWith('/canteen/cariler/')) return '/canteen/cariler'
  if (path.startsWith('/canteen/yapilan-satislar/')) return '/canteen/yapilan-satislar'
  if (path.startsWith('/canteen/ayarlar/') && path !== '/canteen/ayarlar') return '/canteen/ayarlar'
  if (path.startsWith('/canteen/qr-siparisleri/') && path !== '/canteen/qr-siparisleri') return '/canteen/qr-siparisleri'
  if (path.startsWith('/canteen/stok/') && path !== '/canteen/stok') return '/canteen/stok'
  if (path.startsWith('/canteen/raporlar/') && path !== '/canteen/raporlar') return '/canteen/raporlar'

  if (path.startsWith('/platform')) return '/platform/kermes-tenants'
  if (path.startsWith('/superadmin')) return '/superadmin/tenants'

  return null
}

const canUseHistoryBack = () => {
  try {
    const idx = window.history?.state?.idx
    if (typeof idx === 'number') return idx > 0
    return window.history.length > 1
  } catch {
    return false
  }
}

const hasAnyAuthToken = () => (
  hasAuthToken('token_restaurant') ||
  hasAuthToken('token_canteen') ||
  hasAuthToken('token_platform')
)

const resolveHomePath = (user) => {
  if (!user) return null
  if (user.role === 'superadmin') return '/superadmin/tenants'
  if (user.role === 'platform_admin') return '/platform'
  if (user.systemType === 'canteen' || user.systemType === 'kantin') return '/canteen'
  return '/kermes'
}

function CapacitorBackButtonHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, tenantCtx, loading } = useAuth()

  useEffect(() => {
    let isMounted = true

    const register = async () => {
      try {
        if (!Capacitor.isNativePlatform()) return null
        const appPlugin = window?.Capacitor?.Plugins?.App
        if (!appPlugin?.addListener) return null

        return await appPlugin.addListener('backButton', ({ canGoBack }) => {
          if (!isMounted) return

          const pathname = String(location.pathname || '')
          const isPublicRoute = EXIT_ROUTES.has(pathname)
          const hasToken = hasAnyAuthToken()
          const isAuthenticated = !!user || hasToken
          const homePath = user ? resolveHomePath(user) : null

          if (!isAuthenticated && isPublicRoute) {
            appPlugin.exitApp?.()
            return
          }

          if (user && (canGoBack || canUseHistoryBack())) {
            navigate(-1)
            return
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
            return
          }

          if (isAuthenticated && pathname !== '/login') {
            navigate('/login', { replace: true })
          }
        })
      } catch {
        return null
      }
    }

    const listenerPromise = register()

    return () => {
      isMounted = false
      Promise.resolve(listenerPromise)
        .then((listener) => listener?.remove?.())
        .catch(() => {})
    }
  }, [loading, location.pathname, navigate, tenantCtx, user])

  return null
}

const getDefaultRoute = (user, tenantCtx) => {
  if (!user) return null
  if (user.role === 'superadmin') return '/superadmin/tenants'
  if (user.role === 'platform_admin') return '/platform/kermes-tenants'

  const perms = Array.isArray(user.permissions) ? user.permissions : []
  const isExpired = isSubscriptionExpired(tenantCtx)
  const canSettings = user.role === 'tenant_admin' || perms.includes('manage_settings') || perms.includes('manage_menu')

  if (isExpired) {
    return user.role === 'tenant_admin'
      ? getSubscriptionUpgradePath(user.systemType)
      : getSubscriptionProfilePath(user.systemType)
  }

  if (user.systemType === 'canteen' || user.systemType === 'kantin') return '/canteen/kasa'

  if (user.role === 'tenant_admin' || perms.includes('reports_dashboard_view')) return '/kermes/app/dashboard'
  if (user.role === 'tenant_admin' || perms.includes('manage_tables')) return '/kermes/app/tables'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('kitchen_access'))) return '/kermes/app/kitchen'
  if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('walkin_access')))) return '/kermes/app/walkin'
  if (!isExpired && (user.role === 'tenant_admin' || (perms.includes('pos_access') && perms.includes('view_delivery')))) return '/kermes/app/delivery'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('package_courier_page_view') || perms.includes('package_orders_view'))) return '/kermes/app/package-courier'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('closed_tables_page_view'))) return '/kermes/app/reports/sales'
  if (!isExpired && (user.role === 'tenant_admin' || perms.includes('view_accounts') || perms.includes('manage_accounts'))) return '/kermes/app/accounts'
  if (canSettings) return '/kermes/settings'
  if (user.role === 'tenant_admin' || perms.includes('audit_view')) return '/kermes/app/audit'
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
  return <LandingPage />
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

export default function App() {
  return (
    <AuthProvider>
      <BusinessSettingsProvider>
        <CapacitorBackButtonHandler />
        <Toast />
        <Routes>
        <Route path="/" element={<RootEntryRoute />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginSelectionPage />} />
        <Route path="/platform-login" element={<PlatformLogin />} />
        <Route path="/platform/login" element={<Navigate to="/platform-login" replace />} />
        <Route path="/login/platform" element={<Navigate to="/platform-login" replace />} />
        <Route path="/login/restoran" element={<SignIn portal="restaurant" />} />
        <Route path="/login/kantin" element={<Navigate to="/canteen/login" replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/menu/:tenantSlug" element={<PublicMenuPage />} />
        <Route path="/qr/:slug" element={<CanteenQrPricePage />} />
        <Route path="/digital-menu" element={<DigitalMenuPage />} />
        <Route path="/qr-menu" element={<DigitalMenuPage />} />
        <Route path="/canteen/login" element={<CanteenLogin />} />
        <Route
          path="/canteen/ayarlar/website"
          element={
            <ProtectedRoute
              roles={['tenant_admin', 'staff']}
              permissions={['manage_settings']}
              system="canteen"
              allowExpired
            >
              <NotFound />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kermes/settings/website"
          element={
            <ProtectedRoute
              roles={['tenant_admin', 'staff']}
              permissions={['manage_settings', 'manage_menu']}
              permissionsMode="any"
              system="kermes"
              allowExpired
            >
              <NotFound />
            </ProtectedRoute>
          }
        />
        <Route path="/canteen" element={<CanteenLayout />}>
          <Route index element={<Navigate to="/canteen/kasa" replace />} />
          <Route path="kasa" element={<CanteenCashierPage />} />
          <Route path="qr-siparisleri" element={<CanteenQrOrdersPage />} />
          <Route path="cariler" element={<CanteenCustomersPage />} />
          <Route path="cariler/:id" element={<CanteenCustomerDetailPage />} />
          <Route path="yapilan-satislar" element={<CanteenSalesPage />} />
          <Route path="raporlar" element={<CanteenReportsPage />} />
          <Route path="stok" element={<CanteenStockPage />} />
          <Route path="print-station" element={<CanteenPrintStationPage />} />
          <Route path="ayarlar" element={<CanteenSettingsLayout />}>
            <Route path="me" element={<CanteenSettingsMePage />} />
            <Route path="sistem" element={<CanteenSettingsSystemPage />} />
            <Route path="subeler" element={<CanteenSettingsBranchesPage />} />
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
          <Route path="platform-admin" element={<Navigate to="/platform/kermes-tenants" replace />} />
          <Route path="platform" element={<Navigate to="/platform/kermes-tenants" replace />} />
          <Route path="platform/kermes-tenants" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminTenants key="kermes" system="kermes" /></ProtectedRoute>} />
          <Route path="platform/canteen-tenants" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminTenants key="canteen" system="canteen" /></ProtectedRoute>} />
          <Route path="platform/plans" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminPlans /></ProtectedRoute>} />
          <Route path="platform/billing-requests" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><PlatformAdminMembershipRequests /></ProtectedRoute>} />
          <Route path="platform/payments" element={<Navigate to="/platform/billing-requests" replace />} />
          <Route path="platform/settings/me" element={<ProtectedRoute roles={['platform_admin', 'superadmin']}><SettingsMePage apiBase="/api/platform" /></ProtectedRoute>} />
          <Route path="superadmin/tenants" element={<ProtectedRoute roles={['superadmin']}><SuperadminTenants /></ProtectedRoute>} />
          <Route path="superadmin/website-settings" element={<ProtectedRoute roles={['superadmin']}><SuperadminWebsiteSettings /></ProtectedRoute>} />
        </Route>

        <Route path="/platform/tenants" element={<Navigate to="/platform/kermes-tenants" replace />} />
        <Route path="/platform-admin/kermes-tenants" element={<Navigate to="/platform/kermes-tenants" replace />} />
        <Route path="/platform-admin/plans" element={<Navigate to="/platform/plans" replace />} />
        <Route path="/platform-admin/billing-requests" element={<Navigate to="/platform/billing-requests" replace />} />
        <Route path="/platform-admin/payments" element={<Navigate to="/platform/billing-requests" replace />} />

        <Route path="/kermes" element={<Layout />}>
          <Route index element={<KermesIndexRedirect />} />
          <Route path="app/dashboard" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><Dashboard /></ProtectedRoute>} />
          <Route path="app/tables" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_tables']} system="kermes"><TablesPage /></ProtectedRoute>} />
          <Route path="app/kitchen" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['kitchen_access']} system="kermes"><KitchenPage /></ProtectedRoute>} />
          <Route path="app/kitchen/bulk" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['kitchen_access']} system="kermes"><KitchenBulkPage /></ProtectedRoute>} />
          <Route path="app/walkin" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'walkin_access']} system="kermes"><WalkInPosPage /></ProtectedRoute>} />
          <Route path="app/walkin/:orderId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'walkin_access']} system="kermes"><WalkInPosPage /></ProtectedRoute>} />
          <Route path="app/delivery" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'view_delivery']} system="kermes"><DeliveryOrdersPage /></ProtectedRoute>} />
          <Route path="app/delivery/:orderId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'view_delivery']} system="kermes"><DeliveryOrderDetailPage /></ProtectedRoute>} />
          <Route path="app/package-courier" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['package_courier_page_view', 'package_orders_view', 'view_delivery']} permissionsMode="any" system="kermes"><PackageCourierPage /></ProtectedRoute>} />
          <Route path="app/reports" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><ReportsPage /></ProtectedRoute>} />
          <Route path="app/reports/sales" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['closed_tables_page_view']} system="kermes"><ReportsSales /></ProtectedRoute>} />
          <Route path="app/product-report" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><ProductReportPage /></ProtectedRoute>} />
          <Route path="app/accounts" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['view_accounts', 'manage_accounts']} permissionsMode="any" system="kermes"><AccountsPage /></ProtectedRoute>} />
          <Route path="app/accounts/:id" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['view_accounts', 'manage_accounts']} permissionsMode="any" system="kermes"><AccountDetailPage /></ProtectedRoute>} />
          <Route path="app/audit" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['audit_view']} system="kermes"><AuditPage /></ProtectedRoute>} />
          <Route path="app/pos" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access']} system="kermes"><PosPage /></ProtectedRoute>} />
          <Route path="app/pos/orders/:id/receipt" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access']} system="kermes"><ReceiptPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings', 'manage_menu']} permissionsMode="any" system="kermes" allowExpired><SettingsPage /></ProtectedRoute>}>
            <Route path="me" element={<ProtectedRoute roles={['tenant_admin', 'staff']} system="kermes" allowExpired><SettingsMePage apiBase="/api/tenant" /></ProtectedRoute>} />
            <Route path="system" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsSystemContent /></ProtectedRoute>} />
            <Route path="branches" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><BranchesPage /></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><StaffPage systemType="kermes" /></ProtectedRoute>} />
            <Route path="catalog" element={<Navigate to="/kermes/settings/catalog/items" replace />} />
            <Route path="catalog/categories" element={<Navigate to="/kermes/settings/catalog/items" replace />} />
            <Route path="catalog/items" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><MenuItemsPage /></ProtectedRoute>} />
            <Route path="catalog/items/:itemId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><ProductItemSettingsPage /></ProtectedRoute>} />
            <Route path="tables" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsTablesContent /></ProtectedRoute>} />
            <Route path="printers" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><PrintingSettingsPage system="kermes" /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsPaymentsContent /></ProtectedRoute>} />
            <Route path="delivery" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsDeliveryPage /></ProtectedRoute>} />
            <Route path="billing" element={<ProtectedRoute roles={['tenant_admin']} system="kermes" allowExpired><UpgradePlan /></ProtectedRoute>} />
            <Route path="qr" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><QrMenuSettingsPage /></ProtectedRoute>} />
            <Route path="menü" element={<Navigate to="/kermes/settings/catalog" replace />} />
            <Route path="menu/categories" element={<Navigate to="/kermes/settings/catalog/items" replace />} />
            <Route path="menu/items" element={<Navigate to="/kermes/settings/catalog/items" replace />} />
            <Route path="qr-menü" element={<Navigate to="/kermes/settings/qr" replace />} />
          </Route>
          <Route path="print-station" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><PrintStationPage system="kermes" /></ProtectedRoute>} />
          <Route path="*" element={<KermesIndexRedirect />} />
        </Route>

        <Route path="/app/settings/*" element={<Navigate to="/kermes/settings/system" replace />} />
        <Route path="/app/*" element={<Navigate to="/kermes" replace />} />
        <Route path="/accounts" element={<Navigate to="/kermes/app/accounts" replace />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </BusinessSettingsProvider>
    </AuthProvider>
  )
}
