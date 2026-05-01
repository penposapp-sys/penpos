import React, { useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import MobileTopSheetNav from '../../components/MobileTopSheetNav.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import { normalizePermissions } from '../../constants/permissions.js'
import { useTheme } from '../../theme/ThemeContext.jsx'

const tokenKey = 'token_canteen'

const todayLabel = () => {
  return new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export default function CanteenLayout() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [me, setMe] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, themeKey } = useTheme()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.title = 'PenPOS - Kantin'
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    try { document.body.classList.add('scroll-lock') } catch {}
    return () => {
      try { document.body.classList.remove('scroll-lock') } catch {}
    }
  }, [mobileMenuOpen])

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
  const IconLogout = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5M3 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
    return (itemsBase || []).map((i) => {
      const path = String(i.to || '')
      const active = pathname === path || pathname.startsWith(path + '/')
      return { ...i, active }
    })
  }, [itemsBase, pathname])

  const current = items
    .filter((i) => pathname === i.to || pathname.startsWith(String(i.to || '') + '/'))
    .sort((a, b) => String(b.to || '').length - String(a.to || '').length)[0]

  const pageTitle = current?.label || 'Kantin'
  const gridCols = isMobilePortrait ? '1fr' : `${desktopCollapsed ? (isTablet ? 92 : 94) : 228}px 1fr`
  const isMono = themeKey === 'mono'
  const shellBg = '#f5f7fb'
  const sidebarText = isMono ? '#1f2937' : '#ffffff'
  const sidebarMuted = isMono ? 'rgba(31,41,55,0.74)' : 'rgba(255,255,255,0.74)'
  const sidebarIconBg = isMono ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)'
  const sidebarHoverBg = isMono ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.14)'
  const sidebarActiveShadow = theme.activeGlow || '0 18px 45px rgba(15, 23, 42, 0.22)'
  const shellShadow = isMono ? '0 14px 34px rgba(24, 24, 27, 0.08)' : '0 18px 42px rgba(15, 23, 42, 0.08)'
  const sidebarShadow = isMono ? '0 14px 32px rgba(24, 24, 27, 0.12)' : '0 24px 48px rgba(15, 23, 42, 0.22)'
  const topbarBorder = isMono ? 'rgba(24,24,27,0.08)' : theme.border
  const accountLabel = String(me?.name || me?.fullName || me?.username || me?.email || 'Kullanici').trim()
  const accountInitial = String(accountLabel || 'K').trim().charAt(0).toUpperCase()
  const navButtonWidth = desktopCollapsed ? 58 : 188
  const navItemHeight = desktopCollapsed ? 44 : 46
  const navItemGap = 8
  const navStep = navItemHeight + navItemGap
  const activeIndex = items.findIndex((item) => item.to === current?.to)

  if (!localStorage.getItem(tokenKey) && !loading) {
    return <Navigate to="/canteen/login" replace />
  }

  if (loading) {
    return (
      <div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="card">Yukleniyor...</div>
      </div>
    )
  }

  if (!me) {
    return <Navigate to="/canteen/login" replace />
  }

  const logout = () => {
    try { localStorage.removeItem(tokenKey) } catch {}
    nav('/canteen/login', { replace: true })
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: shellBg, color: '#0f172a' }}>
      <MobileTopSheetNav
        open={isMobilePortrait && mobileMenuOpen}
        title="Menu"
        items={items}
        onClose={() => setMobileMenuOpen(false)}
        onSelect={(i) => {
          if (!i?.to) return
          nav(i.to)
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          gap: 14,
          height: '100%',
          padding: isMobilePortrait ? 12 : 16,
          overflow: 'hidden'
        }}
      >
        {!isMobilePortrait && (
          <aside
            style={{
              position: 'relative',
              zIndex: 20,
              minHeight: 0,
              borderRadius: 34,
              background: theme.sidebar,
              padding: desktopCollapsed ? '12px 10px' : '12px',
              boxShadow: sidebarShadow,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: sidebarText
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setDesktopCollapsed((value) => !value)}
                style={{
                  width: desktopCollapsed ? 64 : 144,
                  height: 64,
                  borderRadius: 24,
                  border: 'none',
                  background: '#ffffff',
                  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.16)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  transition: 'width 320ms ease'
                }}
                aria-label="Sidebar ac kapat"
              >
                <img
                  src={desktopCollapsed ? '/logo-1.png' : '/logo-2.png'}
                  alt="PenPOS"
                  style={{
                    width: desktopCollapsed ? 36 : 112,
                    height: desktopCollapsed ? 36 : 42,
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    display: 'block'
                  }}
                  onError={(e) => { e.currentTarget.src = '/penpos%20logo.png' }}
                />
              </button>
            </div>

            <div style={{ position: 'relative', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <nav style={{ minHeight: 0, flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 4px 20px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div
                  style={{
                    position: 'relative',
                    width: navButtonWidth,
                    marginLeft: 'auto',
                    marginRight: desktopCollapsed ? 'auto' : 0,
                    display: 'grid',
                    gap: navItemGap
                  }}
                >
                  {activeIndex >= 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        zIndex: 0,
                        width: navButtonWidth,
                        height: navItemHeight,
                        borderRadius: 22,
                        background: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.72)',
                        boxShadow: sidebarActiveShadow,
                        transform: `translateY(${activeIndex * navStep}px)`,
                        transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), width 220ms ease'
                      }}
                    />
                  )}

                  {items.map((item) => {
                    const Icon = item.icon
                    const active = item.to === current?.to

                    return (
                      <button
                        key={item.to}
                        type="button"
                        className="sidebar-menu-button"
                        title={item.label}
                        onClick={() => nav(item.to)}
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: navButtonWidth,
                          height: navItemHeight,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: desktopCollapsed ? 'center' : 'flex-start',
                          gap: desktopCollapsed ? 0 : 10,
                          padding: desktopCollapsed ? 0 : '0 12px',
                          border: 'none',
                          borderRadius: 22,
                          background: 'transparent',
                          color: active ? '#0f172a' : sidebarMuted,
                          cursor: 'pointer',
                          fontWeight: 900,
                          textAlign: 'left'
                        }}
                      >
                        {!active && (
                          <span
                            className="sidebar-menu-hover"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: 22,
                              pointerEvents: 'none',
                              background: sidebarHoverBg
                            }}
                          />
                        )}
                        <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: desktopCollapsed ? 0 : 10 }}>
                          <span
                            style={{
                              display: 'grid',
                              width: desktopCollapsed ? 34 : 36,
                              height: desktopCollapsed ? 34 : 36,
                              placeItems: 'center',
                              borderRadius: 15,
                              background: active ? theme.accent : sidebarIconBg,
                              color: active ? '#ffffff' : sidebarText,
                              boxShadow: active ? `0 14px 30px ${theme.accent}33` : 'none',
                              transition: 'all 260ms ease'
                            }}
                          >
                            <Icon size={15} />
                          </span>
                          {!desktopCollapsed && (
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>
                              {item.label}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </nav>

              <div style={{ marginTop: 'auto', paddingTop: 10, display: 'grid', gap: 8, justifyItems: desktopCollapsed ? 'center' : 'end' }}>
                {!desktopCollapsed && (
                  <div
                    style={{
                      width: navButtonWidth,
                      padding: '0 6px',
                      color: sidebarMuted,
                      fontSize: 11.5,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {accountLabel}
                  </div>
                )}
                <button
                  type="button"
                  className="sidebar-menu-button"
                  onClick={logout}
                  title="Cikis"
                  style={{
                    width: navButtonWidth,
                    height: navItemHeight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: desktopCollapsed ? 'center' : 'flex-start',
                    gap: desktopCollapsed ? 0 : 10,
                    padding: desktopCollapsed ? 0 : '0 12px',
                    borderRadius: 22,
                    border: 'none',
                    background: desktopCollapsed ? 'rgba(255,255,255,0.1)' : '#ffffff',
                    color: desktopCollapsed ? sidebarText : '#0f172a',
                    cursor: 'pointer',
                    fontWeight: 900,
                    boxShadow: desktopCollapsed ? 'none' : '0 16px 32px rgba(15, 23, 42, 0.14)'
                  }}
                >
                  <span style={{ display: 'grid', width: desktopCollapsed ? 34 : 36, height: desktopCollapsed ? 34 : 36, placeItems: 'center', borderRadius: 15, background: desktopCollapsed ? 'rgba(255,255,255,0.08)' : theme.accent, color: '#ffffff' }}>
                    <IconLogout size={15} />
                  </span>
                  {!desktopCollapsed && <span>Cikis</span>}
                </button>
              </div>
            </div>
          </aside>
        )}

        <main
          style={{
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 34,
            background: '#ffffff',
            padding: isMobilePortrait ? 14 : 18,
            boxShadow: shellShadow
          }}
        >
          <header className="topbar" style={{ marginBottom: 16, background: 'transparent', borderBottom: 'none', boxShadow: 'none', padding: 0, flexShrink: 0, position: 'static' }}>
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
                border: `1px solid ${topbarBorder}`,
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isMobilePortrait && (
                  <button
                    className="hamburger-btn"
                    style={{
                      width: 40,
                      height: 36,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 14,
                      background: theme.accentSoft,
                      borderColor: topbarBorder,
                      color: theme.accentText
                    }}
                    aria-label="Menu"
                    onClick={() => setMobileMenuOpen((value) => !value)}
                  >
                    &#8801;
                  </button>
                )}
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 900, color: theme.text, fontSize: isMobilePortrait ? 20 : 28 }}>{pageTitle}</span>
                    <span className="page-pill">{session?.branchName || 'Kantin Paneli'}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    Siparis, cariler, stok ve ayar akisini tema ile ayni dilde yonet.
                  </div>
                </div>
              </div>

              <div className="topbar-meta" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className="page-pill">{todayLabel()}</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px 6px 6px',
                    borderRadius: 18,
                    border: `1px solid ${topbarBorder}`,
                    background: '#ffffff',
                    color: theme.text
                  }}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 14,
                      display: 'grid',
                      placeItems: 'center',
                      background: theme.accent,
                      color: '#ffffff',
                      fontWeight: 900
                    }}
                  >
                    {accountInitial}
                  </span>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>{accountLabel}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.1 }}>{me?.role === 'tenant_admin' ? 'Yonetici' : 'Personel'}</span>
                  </div>
                </div>
                {isMobilePortrait && (
                  <button
                    className="btn"
                    type="button"
                    onClick={logout}
                    style={{ borderRadius: 16, fontWeight: 900 }}
                  >
                    Cikis
                  </button>
                )}
              </div>
            </div>
          </header>

          <section style={{ minHeight: 0, flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: isMobilePortrait ? 0 : 2 }}>
            <div style={{ minWidth: 0, minHeight: '100%' }}>
              <div className="main" style={{ minHeight: '100%', padding: 0 }}>
                <Outlet context={{ me, session }} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
