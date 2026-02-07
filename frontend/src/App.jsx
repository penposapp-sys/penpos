import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EntryPage from './pages/EntryPage.jsx'
import SignIn from './pages/SignIn.jsx'
import PlatformLogin from './pages/PlatformLogin.jsx'
import SuperadminTenants from './pages/SuperadminTenants.jsx'
import PlatformAdminTenants from './pages/PlatformAdminTenants.jsx'
import PlatformAdminPlans from './pages/PlatformAdminPlans.jsx'
import PlatformAdminPaymentRequests from './pages/PlatformAdminPaymentRequests.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import StaffPage from './pages/StaffPage.jsx'
import SettingsPage, { SettingsSystemContent, SettingsMenuHub, SettingsTablesContent, SettingsPaymentsContent } from './pages/SettingsPage.jsx'
import SettingsMePage from './pages/SettingsMePage.jsx'
import SettingsDeliveryPage from './pages/SettingsDeliveryPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import MenuItemsPage from './pages/MenuItemsPage.jsx'
import PosPage from './pages/PosPage.jsx'
import WalkInPosPage from './pages/WalkInPosPage.jsx'
import DeliveryOrdersPage from './pages/DeliveryOrdersPage.jsx'
import KitchenPage from './pages/KitchenPage.jsx'
import KitchenBulkPage from './pages/KitchenBulkPage.jsx'
import ReportsSales from './pages/ReportsSales.jsx'
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
import QrMenuSettingsPage from './pages/QrMenuSettingsPage.jsx'
import NotFound from './pages/NotFound.jsx'
import PrintingSettingsPage from './pages/PrintingSettingsPage.jsx'
import PrintStationPage from './pages/PrintStationPage.jsx'

import CanteenLayout from './canteen/layout/CanteenLayout.jsx'
import CanteenLogin from './canteen/pages/CanteenLogin.jsx'
import CanteenCashierPage from './canteen/pages/CanteenCashierPage.jsx'
import CanteenCustomersPage from './canteen/pages/CanteenCustomersPage.jsx'
import CanteenCustomerDetailPage from './canteen/pages/CanteenCustomerDetailPage.jsx'
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

const ProductReportPage = _ProductReportPage

export default function App() {
  const KermesIndexRedirect = () => {
    const { user, loading } = useAuth()
    if (loading) return <div className="card">Yükleniyor...</div>
    if (!user) return <Navigate to="/" replace />

    if (user.role === 'tenant_admin' || user.role === 'superadmin') {
      return <Navigate to="/kermes/app/dashboard" replace />
    }

    const perms = Array.isArray(user.permissions) ? user.permissions : []
    if (perms.includes('reports_dashboard_view')) return <Navigate to="/kermes/app/dashboard" replace />
    if (perms.includes('closed_tables_page_view')) return <Navigate to="/kermes/app/reports/sales" replace />
    return <div className="card">Yetkili sayfa yok, yöneticinle görüş</div>
  }

  return (
    <AuthProvider>
      <Toast />
      <Routes>
        <Route path="/menu/:tenantSlug" element={<PublicMenuPage />} />
        <Route path="/canteen/login" element={<CanteenLogin />} />
        <Route path="/canteen" element={<CanteenLayout />}>
          <Route index element={<Navigate to="/canteen/kasa" replace />} />
          <Route path="kasa" element={<CanteenCashierPage />} />
          <Route path="cariler" element={<CanteenCustomersPage />} />
          <Route path="cariler/:id" element={<CanteenCustomerDetailPage />} />
          <Route path="raporlar" element={<CanteenReportsPage />} />
          <Route path="stok" element={<CanteenStockPage />} />
          <Route path="print-station" element={<CanteenPrintStationPage />} />
          <Route path="ayarlar" element={<CanteenSettingsLayout />}>
            <Route path="me" element={<CanteenSettingsMePage />} />
            <Route path="sistem" element={<CanteenSettingsSystemPage />} />
            <Route path="subeler" element={<CanteenSettingsBranchesPage />} />
            <Route path="personel" element={<CanteenSettingsStaffPage />} />
            <Route path="urunler" element={<CanteenSettingsProductsPage />} />
            <Route path="yazicilar" element={<CanteenPrintingSettingsPage />} />
            <Route path="odeme" element={<CanteenSettingsPaymentsPage />} />
            <Route path="paket" element={<CanteenSettingsBillingPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Layout />}>
          <Route index element={<EntryPage />} />
          <Route path="login" element={<Navigate to="/" replace />} />
          <Route path="login/platform" element={<PlatformLogin />} />
          <Route path="login/restoran" element={<SignIn portal="kermes" />} />
          <Route path="login/kantin" element={<Navigate to="/canteen/login" replace />} />
          <Route path="platform-login" element={<Navigate to="/login/platform" replace />} />
          <Route path="platform-admin" element={<Navigate to="/platform/kermes-tenants" replace />} />
          <Route path="platform" element={<Navigate to="/platform/kermes-tenants" replace />} />
          <Route
            path="platform/kermes-tenants"
            element={
              <ProtectedRoute roles={['platform_admin']}>
                <PlatformAdminTenants key="kermes" system="kermes" />
              </ProtectedRoute>
            }
          />
          <Route
            path="platform/canteen-tenants"
            element={
              <ProtectedRoute roles={['platform_admin']}>
                <PlatformAdminTenants key="canteen" system="canteen" />
              </ProtectedRoute>
            }
          />
          <Route
            path="platform/plans"
            element={
              <ProtectedRoute roles={['platform_admin']}>
                <PlatformAdminPlans />
              </ProtectedRoute>
            }
          />
          <Route
            path="platform/payments"
            element={
              <ProtectedRoute roles={['platform_admin']}>
                <PlatformAdminPaymentRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="platform/settings/me"
            element={
              <ProtectedRoute roles={['platform_admin']}>
                <SettingsMePage apiBase="/api/platform" />
              </ProtectedRoute>
            }
          />
          <Route
            path="superadmin/tenants"
            element={
              <ProtectedRoute roles={['superadmin']}>
                <SuperadminTenants />
              </ProtectedRoute>
            }
          />
        </Route>
        {/* Legacy admin path redirect if exists */}
        <Route path="/platform/tenants" element={<Navigate to="/platform/kermes-tenants" replace />} />
        <Route path="/platform-admin/kermes-tenants" element={<Navigate to="/platform/kermes-tenants" replace />} />
        <Route path="/platform-admin/plans" element={<Navigate to="/platform/plans" replace />} />
        <Route path="/platform-admin/payments" element={<Navigate to="/platform/payments" replace />} />
        <Route
          path="/kermes"
          element={<Layout />}
        >
          <Route index element={<KermesIndexRedirect />} />
          <Route path="app/dashboard" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><Dashboard /></ProtectedRoute>} />
          <Route path="app/tables" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_tables']} system="kermes"><TablesPage /></ProtectedRoute>} />
          <Route path="app/kitchen" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['kitchen_access']} system="kermes"><KitchenPage /></ProtectedRoute>} />
          <Route path="app/kitchen/bulk" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['kitchen_access']} system="kermes"><KitchenBulkPage /></ProtectedRoute>} />
          <Route path="app/walkin" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'walkin_access']} system="kermes"><WalkInPosPage /></ProtectedRoute>} />
          <Route path="app/walkin/:orderId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'walkin_access']} system="kermes"><WalkInPosPage /></ProtectedRoute>} />
          <Route path="app/delivery" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'view_delivery']} system="kermes"><DeliveryOrdersPage /></ProtectedRoute>} />
          <Route path="app/delivery/:orderId" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access', 'view_delivery']} system="kermes"><DeliveryOrdersPage /></ProtectedRoute>} />
          <Route path="app/reports/sales" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['closed_tables_page_view']} system="kermes"><ReportsSales /></ProtectedRoute>} />
          <Route path="app/product-report" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['reports_dashboard_view']} system="kermes"><ProductReportPage /></ProtectedRoute>} />
          <Route path="app/accounts" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['view_accounts', 'manage_accounts']} permissionsMode="any" system="kermes"><AccountsPage /></ProtectedRoute>} />
          <Route path="app/accounts/:id" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['view_accounts', 'manage_accounts']} permissionsMode="any" system="kermes"><AccountDetailPage /></ProtectedRoute>} />
          <Route path="app/audit" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['audit_view']} system="kermes"><AuditPage /></ProtectedRoute>} />
          <Route path="app/pos" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access']} system="kermes"><PosPage /></ProtectedRoute>} />
          <Route path="app/pos/orders/:id/receipt" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['pos_access']} system="kermes"><ReceiptPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings', 'manage_menu']} permissionsMode="any" system="kermes"><SettingsPage /></ProtectedRoute>}>
            <Route path="me" element={<SettingsMePage apiBase="/api/tenant" />} />
            <Route path="system" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsSystemContent /></ProtectedRoute>} />
            <Route path="branches" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><BranchesPage /></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><StaffPage systemType="kermes" /></ProtectedRoute>} />
            <Route path="catalog" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><SettingsMenuHub /></ProtectedRoute>} />
            <Route path="catalog/categories" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><CategoriesPage /></ProtectedRoute>} />
            <Route path="catalog/items" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><MenuItemsPage /></ProtectedRoute>} />
            <Route path="tables" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsTablesContent /></ProtectedRoute>} />
            <Route path="printers" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><PrintingSettingsPage system="kermes" /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsPaymentsContent /></ProtectedRoute>} />
            <Route path="delivery" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><SettingsDeliveryPage /></ProtectedRoute>} />
            <Route path="billing" element={<ProtectedRoute roles={['tenant_admin']} system="kermes"><UpgradePlan /></ProtectedRoute>} />
            <Route path="qr" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_menu']} system="kermes"><QrMenuSettingsPage /></ProtectedRoute>} />

            <Route path="menu" element={<Navigate to="/kermes/settings/catalog" replace />} />
            <Route path="menu/categories" element={<Navigate to="/kermes/settings/catalog/categories" replace />} />
            <Route path="menu/items" element={<Navigate to="/kermes/settings/catalog/items" replace />} />
            <Route path="qr-menu" element={<Navigate to="/kermes/settings/qr" replace />} />
          </Route>
          <Route path="print-station" element={<ProtectedRoute roles={['tenant_admin', 'staff']} permissions={['manage_settings']} system="kermes"><PrintStationPage system="kermes" /></ProtectedRoute>} />
          <Route path="*" element={<KermesIndexRedirect />} />
        </Route>

        <Route path="/app/settings/*" element={<Navigate to="/kermes/settings/system" replace />} />
        <Route path="/app/*" element={<Navigate to="/kermes" replace />} />
        <Route path="/accounts" element={<Navigate to="/kermes/app/accounts" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
