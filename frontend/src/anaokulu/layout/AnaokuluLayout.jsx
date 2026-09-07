import React, { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { hasAuthToken } from '../../lib/authStorage.js'

const BASE_NAV = [
  { to: '/anaokulu/genel-bakis', label: 'Genel Bakış', icon: '🏠' },
  { to: '/anaokulu/ogrenciler', label: 'Öğrenciler', icon: '👥' },
  { to: '/anaokulu/ucret-taksit', label: 'Ücret & Taksit', icon: '💳' },
  { to: '/anaokulu/tahsilatlar', label: 'Tahsilatlar', icon: '💰' },
  { to: '/anaokulu/faturalar', label: 'Faturalar', icon: '🧾' },
  { to: '/anaokulu/raporlar', label: 'Raporlar', icon: '📊' }
]

export default function AnaokuluLayout() {
  const { user, loading, logout, accessibleTenants, regionCurrentTenantId, setRegionCurrentTenantId, isRegionAdmin, tenantCtx } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      if (hasAuthToken('token_anaokulu')) return
      navigate('/anaokulu/login', { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    const onClick = (e) => {
      if (!schoolDropdownOpen) return
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSchoolDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [schoolDropdownOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  if (loading || !user) return null

  const isManager = isRegionAdmin || user?.role === 'superadmin' || user?.role === 'platform_admin'

  const NAV = [...BASE_NAV]
  if (!isManager) {
    NAV.push({
      to: '/anaokulu/ayarlar',
      label: 'Ayarlar',
      icon: '⚙️',
      subItems: [{ to: '/anaokulu/ayarlar/uyeler', label: 'Üyeler', icon: '👤' }]
    })
  } else {
    NAV.push({ to: '/anaokulu/ayarlar', label: 'Ayarlar', icon: '⚙️' })
    NAV.push({ to: '/anaokulu/okullarim', label: 'Okullarım', icon: '🏫', regionOnly: true })
  }

  const currentTenantForTitle = isManager
    ? (accessibleTenants.find((t) => String(t.id) === String(regionCurrentTenantId)))
    : (tenantCtx?.tenant || user?.tenant)
  const currentSchoolName = currentTenantForTitle?.name || (isManager && accessibleTenants.length === 0 ? 'Okul Seçiniz / Ekleyiniz' : 'Anaokulu Yönetimi')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* ============================================================ */}
      {/* TOP FIXED NAVBAR (Moved to Top as requested by User)         */}
      {/* ============================================================ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: '#0f172a', color: '#f8fafc',
        boxShadow: '0 4px 20px rgba(15,23,42,0.15)',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{
          padding: '0 16px', height: 62,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
        }}>
          
          {/* Brand Logo & School Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 0.5,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span style={{ fontSize: 20 }}>🏫</span>
              <span style={{ display: 'inline-block' }}>ANAOKULU</span>
            </div>

            {/* School Switcher for Admins / Managers */}
            {isManager ? (
              <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  onClick={() => setSchoolDropdownOpen((v) => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                    borderRadius: 10, background: 'rgba(99,102,241,0.2)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    color: '#c7d2fe', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentSchoolName}
                  </span>
                  <span style={{ opacity: 0.8, fontSize: 10 }}>▾</span>
                </button>
                {schoolDropdownOpen && (
                  <div style={{
                    position: 'absolute', left: 0, top: 'calc(100% + 8px)', minWidth: 260, maxWidth: 360,
                    background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(15,23,42,0.25)',
                    border: '1px solid #e2e8f0', padding: 6, zIndex: 1001
                  }}>
                    {accessibleTenants.length === 0 && (
                      <div style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>Erişilebilir anaokulu yok</div>
                    )}
                    {accessibleTenants.map((t) => {
                      const active = String(t.id) === String(regionCurrentTenantId)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setRegionCurrentTenantId(String(t.id))
                            setSchoolDropdownOpen(false)
                          }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontWeight: active ? 800 : 500, fontSize: 13,
                            background: active ? 'rgba(99,102,241,0.10)' : 'transparent',
                            color: active ? '#4f46e5' : '#0f172a'
                          }}
                        >
                          🏫 {t.name}
                          {active && <span style={{ marginLeft: 8, color: '#6366f1' }}>●</span>}
                        </button>
                      )
                    })}
                    <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 4 }}>
                      <NavLink
                        to="/anaokulu/okullarim"
                        onClick={() => setSchoolDropdownOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '8px 12px', borderRadius: 8,
                          background: '#f8fafc', color: '#4f46e5', textDecoration: 'none',
                          fontWeight: 700, fontSize: 12
                        }}
                      >
                        + Yeni Okul Ekle / Tümünü Gör
                      </NavLink>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: '#94a3b8', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentSchoolName}
              </span>
            )}
          </div>

          {/* Navigation Items (Horizontal Top Bar) */}
          <nav style={{
            display: 'flex', alignItems: 'center', gap: 4,
            overflowX: 'auto', padding: '4px 0', scrollbarWidth: 'none',
            flex: 1, minWidth: 0, justifyContent: 'center'
          }}>
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                style={({ isActive }) => ({
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 8,
                  color: isActive ? '#fff' : '#94a3b8',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                })}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Profile & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {isManager && (
              <span style={{
                display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                background: 'rgba(99,102,241,0.2)', color: '#c7d2fe',
                fontSize: 11, fontWeight: 800, border: '1px solid rgba(99,102,241,0.3)',
                whiteSpace: 'nowrap'
              }}>
                {user?.role === 'superadmin' ? 'SÜPER ADMİN' : user?.role === 'platform_admin' ? 'PLATFORM YÖNETİCİSİ' : 'OKUL SÜPER ADMİN'}
              </span>
            )}
            <span style={{ color: '#cbd5e1', fontSize: 13, whiteSpace: 'nowrap' }}>
              <b>{user?.name}</b>
            </span>
            <button
              onClick={logout}
              style={{
                padding: '6px 12px', borderRadius: 8, background: '#ef4444', color: '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                boxShadow: '0 2px 6px rgba(239,68,68,0.3)'
              }}
            >
              Çıkış
            </button>
          </div>

        </div>
      </header>

      {/* Main content page area (Full width, responsive) */}
      <main style={{
        flex: 1,
        padding: '16px 20px',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}>
        <Outlet />
      </main>

    </div>
  )
}
