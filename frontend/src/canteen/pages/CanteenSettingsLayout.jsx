import React, { useMemo } from 'react'
import { Link, Outlet, useLocation, useOutletContext, useNavigate } from 'react-router-dom'
import SettingsSubnav from '../../components/SettingsSubnav.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

export default function CanteenSettingsLayout() {
  const { pathname } = useLocation()
  const { me } = useOutletContext()
  const nav = useNavigate()
  const { isMobilePortrait } = useResponsiveFlags()

  const canSettings = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('manage_settings'))
  if (!canSettings) return <div className="card">403 – Bu sayfaya yetkin yok</div>

  const items = useMemo(() => ([
    { path: '/canteen/ayarlar/me', label: 'Hesabım' },
    { path: '/canteen/ayarlar/sistem', label: 'Sistem Ayarları' },
    { path: '/canteen/ayarlar/subeler', label: 'Şube Ayarları' },
    { path: '/canteen/ayarlar/personel', label: 'Personel Ayarları' },
    { path: '/canteen/ayarlar/urunler', label: 'Ürün Ayarları' },
    { path: '/canteen/ayarlar/yazicilar', label: 'Yazıcı Ayarları' },
    { path: '/canteen/ayarlar/odeme', label: 'Ödeme Seçenekleri' },
    { path: '/canteen/ayarlar/paket', label: 'Üyelik & Paket' }
  ]), [])

  const basePath = '/canteen/ayarlar'
  const isRoot = pathname === basePath || pathname === basePath + '/'

  const current = (items || [])
    .filter(i => pathname === i.path || pathname.startsWith(i.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]

  if (isMobilePortrait) {
    if (isRoot) {
      return (
        <div className="main pageMobile">
          <div style={{ fontWeight: 900, fontSize: 18 }}>Ayarlar</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((i) => (
              <Link
                key={i.path}
                to={i.path}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
              >
                <div style={{ fontWeight: 800 }}>{i.label}</div>
                <div style={{ color: 'var(--muted)', fontWeight: 900 }}>›</div>
              </Link>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="main pageMobile">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => nav('/canteen/ayarlar')}>← Ayarlara Dön</button>
          <div style={{ fontWeight: 900 }}>{current?.label || 'Ayarlar'}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <Outlet context={{ me }} />
        </div>
      </div>
    )
  }

  return (
    <div className="settingsLayout">
      <SettingsSubnav title="Ayarlar" items={items} />
      <div style={{ display: 'grid', gap: 16 }}>
        <Outlet context={{ me }} />
      </div>
    </div>
  )
}
