import React, { useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import SidebarNav from '../../components/SidebarNav.jsx'
import MobileTopSheetNav from '../../components/MobileTopSheetNav.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import { normalizePermissions } from '../../constants/permissions.js'

const tokenKey = 'token_canteen'

export default function CanteenLayout() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [me, setMe] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [desktopCollapsed, setDesktopCollapsed] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])
  useEffect(() => { document.title = 'PenPOS – Kantin' }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    try { document.body.classList.add('scroll-lock') } catch {}
    return () => {
      try { document.body.classList.remove('scroll-lock') } catch {}
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const run = async () => {
      const token = localStorage.getItem(tokenKey)
      if (!token) {
        setMe(null)
        setSession(null)
        setLoading(false)
        return
      }
      setLoading(true)
      const res = await api('/api/auth/me', { silent: true, suppressAuthRedirect: true })
      if (!res?.ok || !res?.user) {
        try { localStorage.removeItem(tokenKey) } catch {}
        setMe(null)
        setSession(null)
        setLoading(false)
        return
      }
      const u = res.user
      const normalized = u ? { ...u, permissions: normalizePermissions(u.permissions) } : u
      if (u.role === 'platform_admin' || u.role === 'superadmin' || u.systemType !== 'kantin') {
        try { localStorage.removeItem(tokenKey) } catch {}
        setMe(null)
        setSession(null)
        setLoading(false)
        return
      }
      setMe(normalized)

      const sess = await api('/api/canteen/session', { silent: true, suppressAuthRedirect: true })
      setSession(sess?.ok ? sess : null)
      setLoading(false)
    }
    run()
  }, [])

  useEffect(() => {
    if (!me) return
    const run = async () => {
      const sess = await api('/api/canteen/session', { silent: true, suppressAuthRedirect: true })
      setSession(sess?.ok ? sess : null)
    }
    run()
  }, [pathname, me?.id])

  useEffect(() => {
    if (!me) return
    const handler = async () => {
      const sess = await api('/api/canteen/session', { silent: true, suppressAuthRedirect: true })
      setSession(sess?.ok ? sess : null)
    }
    window.addEventListener('canteen:session-updated', handler)
    return () => window.removeEventListener('canteen:session-updated', handler)
  }, [me?.id])

  const IconCart = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M6 6h15l-1.5 9H7.5L6 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M6 6l-2-2H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="20" r="1" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="20" r="1" stroke="currentColor" strokeWidth="2"/></svg>
  )
  const IconUsers = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )
  const IconBarChart = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 19V9m6 10V5m6 14v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )
  const IconSettings = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a7.96 7.96 0 0 0 .1-2 7.96 7.96 0 0 0-.1-2l2.1-1.6-2-3.5-2.5 1a8.2 8.2 0 0 0-3.4-2l-.4-2.6h-4l-.4 2.6a8.2 8.2 0 0 0-3.4 2l-2.5-1-2 3.5L4.6 9a7.96 7.96 0 0 0-.1 2c0 .7.1 1.4.1 2l-2.1 1.6 2 3.5 2.5-1a8.2 8.2 0 0 0 3.4 2l.4 2.6h4l.4-2.6a8.2 8.2 0 0 0 3.4-2l2.5 1 2-3.5-2.1-1.6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
  const IconBoxes = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 0 0-1.2-1.8l-7-3.1a2 2 0 0 0-1.6 0l-7 3.1A2 2 0 0 0 3 8v8a2 2 0 0 0 1.2 1.8l7 3.1a2 2 0 0 0 1.6 0l7-3.1A2 2 0 0 0 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M3.3 7.3 12 11l8.7-3.7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 22V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )

  const itemsBase = useMemo(() => {
    const perms = Array.isArray(me?.permissions) ? me.permissions : []
    const isAdmin = me?.role === 'tenant_admin'
    const canPos = isAdmin || perms.includes('canteen_pos_access')
    const canCustomers = isAdmin || perms.includes('canteen_customers_view') || perms.includes('canteen_customers_manage')
    const canReports = isAdmin || perms.includes('canteen_reports_view')
    const canStock = isAdmin || perms.includes('canteen_stock_manage') || perms.includes('canteen_stock_count')
    const canSettings = isAdmin || perms.includes('manage_settings')
    const base = []
    if (canPos) base.push({ to: '/canteen/kasa', label: 'Kasa', icon: IconCart })
    if (canCustomers) base.push({ to: '/canteen/cariler', label: 'Cariler', icon: IconUsers })
    if (canReports) base.push({ to: '/canteen/raporlar', label: 'Raporlar', icon: IconBarChart })
    if (canStock) base.push({ to: '/canteen/stok', label: 'Stok', icon: IconBoxes })
    if (canSettings) base.push({ to: '/canteen/ayarlar', label: 'Ayarlar', icon: IconSettings })
    return base
  }, [me])

  const items = useMemo(() => {
    return (itemsBase || []).map(i => {
      if (i.type === 'button') return { ...i, active: false }
      const path = String(i.to || '')
      const active = pathname === path || pathname.startsWith(path + '/')
      return { ...i, active }
    })
  }, [itemsBase, pathname])

  const current = items
    .filter(i => i.type !== 'button')
    .filter(i => pathname === i.to || pathname.startsWith(String(i.to || '') + '/'))
    .sort((a, b) => String(b.to || '').length - String(a.to || '').length)[0]

  const gridCols = isMobilePortrait
    ? '1fr'
    : (desktopCollapsed ? `${isTablet ? 64 : 56}px 1fr` : '220px 1fr')

  if (!localStorage.getItem(tokenKey) && !loading) {
    return <Navigate to="/canteen/login" replace />
  }

  if (loading) {
    return (
      <div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="card">Yükleniyor...</div>
      </div>
    )
  }

  if (!me) {
    return <Navigate to="/canteen/login" replace />
  }

  const logout = () => {
    try { localStorage.removeItem('token_canteen') } catch {}
    nav('/canteen/login', { replace: true })
  }

  return (
    <div className="app" style={{ gridTemplateColumns: gridCols, gridTemplateRows: '56px 1fr' }}>
      <MobileTopSheetNav
        open={isMobilePortrait && mobileMenuOpen}
        title="Menü"
        items={items}
        onClose={() => setMobileMenuOpen(false)}
        onSelect={(i) => {
          if (!i?.to) return
          nav(i.to)
        }}
      />
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <img src="/penpos%20logo.png" alt="PenPOS" style={{ height: 26 }} onError={(e) => { e.currentTarget.src = '/penpos-logo.png' }} />
          {!desktopCollapsed && <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Kantin</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700 }}>
          {current && <span className="page-pill">{current.label}</span>}
        </div>
        <div className="topbar-meta">
          <button className="btn btn--compact" onClick={logout}>Çıkış</button>
        </div>
      </header>

      {!isMobilePortrait && (
        <aside className={desktopCollapsed ? 'sidebar icon-rail' : 'sidebar'}>
          <SidebarNav
            items={items}
            collapsed={desktopCollapsed}
            onNavigate={() => {}}
          />
        </aside>
      )}

      <main className="main"><Outlet context={{ me, session }} /></main>
    </div>
  )
}
