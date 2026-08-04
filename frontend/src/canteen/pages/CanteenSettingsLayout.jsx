import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { CreditCard, Globe, Package, Printer, QrCode, Settings, Store, UserRound, Users, Warehouse } from 'lucide-react'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import { isSubscriptionExpired } from '../../lib/subscription.js'
import { useTheme } from '../../theme/ThemeContext.jsx'

const ROOT_PATH = '/canteen/ayarlar'

const SETTINGS_ICONS = {
  website: Globe,
  account: UserRound,
  system: Store,
  branches: Warehouse,
  staff: Users,
  printers: Printer,
  payments: CreditCard,
  billing: Package,
  products: Package,
  qr: QrCode,
  settings: Settings,
}

function SettingsGlyph({ icon, size = 20, strokeWidth = 2.1 }) {
  const Icon = SETTINGS_ICONS[icon]
  if (!Icon) return <Settings size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

function buildSettingsThemeVars(theme) {
  const dark = theme?.darkMode === true
  return {
    '--settings-shell-bg': dark ? '#060606' : '#f4f6fb',
    '--settings-panel-bg': dark ? '#101010' : '#ffffff',
    '--settings-panel-soft': dark ? '#171717' : '#f7f8fc',
    '--settings-panel-elevated': dark ? '#1d1d1d' : '#eef2ff',
    '--settings-border': dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    '--settings-border-strong': dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)',
    '--settings-text': dark ? '#f5f5f5' : '#0f172a',
    '--settings-text-soft': dark ? '#b6b6b6' : '#475569',
    '--settings-text-muted': dark ? '#8c8c8c' : '#64748b',
    '--settings-accent': theme?.accent || '#2f6df6',
    '--settings-accent-2': theme?.accentHover || '#22b8e6',
    '--settings-button-bg': 'var(--menu-active-bg)',
    '--settings-button-bg-hover': 'var(--menu-active-bg)',
    '--settings-button-bg-active': 'var(--menu-active-bg)',
    '--settings-button-border': 'var(--border-hover)',
    '--settings-button-text': 'var(--sidebar-nav-text-active, #ffffff)',
    '--settings-button-disabled-bg': dark ? '#2f2f2f' : '#d1d5db',
    '--settings-button-disabled-border': dark ? '#3f3f46' : '#d1d5db',
    '--settings-button-disabled-text': dark ? '#9ca3af' : '#6b7280',
    '--settings-side-link-active-bg': dark ? 'var(--menu-active-bg)' : 'linear-gradient(135deg, var(--settings-accent), var(--settings-accent-2))',
    '--settings-side-link-active-border': dark ? 'var(--border-hover)' : 'transparent',
    '--settings-side-link-active-text': dark ? 'var(--sidebar-nav-text-active, #ffffff)' : '#ffffff',
    '--settings-side-link-active-shadow': dark ? 'none' : '0 18px 34px rgba(47,109,246,0.26)',
    '--settings-side-link-active-icon-bg': dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)',
    '--settings-side-link-active-icon-border': dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)',
    '--settings-shadow': dark ? '0 28px 80px rgba(0,0,0,0.38)' : '0 22px 56px rgba(15,23,42,0.10)',
    '--settings-card-shadow': dark ? '0 18px 40px rgba(0,0,0,0.24)' : '0 14px 34px rgba(15,23,42,0.08)'
  }
}

function getSettingsItems(isExpired) {
  if (isExpired) {
    return [
      { key: 'website', path: '/canteen/ayarlar/website', label: 'Web Site Ayarlari', icon: 'website', filterGroup: 'Dijital', section: 'Dijital', desc: 'Bu sayfa henuz hazirlanmadi' },
      { key: 'system', path: '/canteen/ayarlar/sistem', label: 'Sistem Ayarlari', icon: 'system', filterGroup: 'İşletme', section: 'İşletme', desc: 'Hesap, gorunum ve sube yonetimi tek sayfada' },
      { key: 'plan', path: '/canteen/ayarlar/paket', label: 'Uyelik ve Paket', icon: 'billing', filterGroup: 'Finans', section: 'Finans', desc: 'Paket bilgileri, tahsilat ve fatura takibi' },
    ]
  }

  return [
    { key: 'system', path: '/canteen/ayarlar/sistem', label: 'Sistem Ayarlari', icon: 'system', filterGroup: 'İşletme', section: 'İşletme', desc: 'Hesap, gorunum ve sube yonetimi tek sayfada' },
    { key: 'products', path: '/canteen/ayarlar/urunler', label: 'Urun Ayarlari', icon: 'products', filterGroup: 'Ürün', section: 'Ürün', desc: 'Urun, kategori, stok ve gorunum duzeni' },
    { key: 'staff', path: '/canteen/ayarlar/personel', label: 'Personel Ayarlari', icon: 'staff', filterGroup: 'Personel', section: 'İşletme', desc: 'Personel, sifre, yetki ve aktiflik yonetimi' },
    { key: 'qr', path: '/canteen/ayarlar/qr', label: 'Online Siparişler', icon: 'qr', filterGroup: 'Dijital', section: 'Dijital', desc: 'Musteri online siparis sayfasi ve yayin ayarlari' },
    { key: 'website', path: '/canteen/ayarlar/website', label: 'Web Site Ayarlari', icon: 'website', filterGroup: 'Dijital', section: 'Dijital', desc: 'Bu sayfa henuz hazirlanmadi' },
    { key: 'printers', path: '/canteen/ayarlar/yazicilar', label: 'Yazici Ayarlari', icon: 'printers', filterGroup: 'Cihaz', section: 'Cihaz', desc: 'Print Agent, fis ve etiket yazicilari' },
    { key: 'payments', path: '/canteen/ayarlar/odeme', label: 'Odeme Secenekleri', icon: 'payments', filterGroup: 'Satış', section: 'Satış', desc: 'Nakit, POS, banka ve cari tahsilat secenekleri' },
    { key: 'billing', path: '/canteen/ayarlar/paket', label: 'Paket ve Satin Alma', icon: 'billing', filterGroup: 'Finans', section: 'Finans', desc: 'Paket durumu, kullanim ve faturalandirma' },
  ]
}

function SettingsChromeStyle() {
  return (
    <style>{`
      .canteen-settings-shell,
      .canteen-settings-shell * { box-sizing: border-box; }
      .canteen-settings-shell { min-height: 100%; color: var(--settings-text); background: var(--settings-shell-bg); }
      .canteen-settings-shell,
      .canteen-settings-shell > *,
      .canteen-settings-shell section,
      .canteen-settings-shell article,
      .canteen-settings-shell div,
      .canteen-settings-shell form {
        min-width: 0;
        max-width: 100%;
      }
      .canteen-settings-shell img,
      .canteen-settings-shell canvas,
      .canteen-settings-shell svg {
        max-width: 100%;
        height: auto;
      }
      .canteen-settings-shell button,
      .canteen-settings-shell a,
      .canteen-settings-shell span,
      .canteen-settings-shell p,
      .canteen-settings-shell h1,
      .canteen-settings-shell h2,
      .canteen-settings-shell h3 {
        overflow-wrap: anywhere;
      }
      .canteen-settings-shell .card {
        background: linear-gradient(180deg, var(--settings-panel-bg), var(--settings-panel-soft)) !important;
        color: var(--settings-text) !important;
        border: 1px solid var(--settings-border) !important;
        box-shadow: var(--settings-card-shadow) !important;
      }
      .canteen-settings-shell .input,
      .canteen-settings-shell input,
      .canteen-settings-shell textarea,
      .canteen-settings-shell select {
        background: color-mix(in srgb, var(--settings-panel-bg) 92%, transparent) !important;
        color: var(--settings-text) !important;
        border: 1px solid var(--settings-border) !important;
        box-shadow: none !important;
      }
      .canteen-settings-shell input::placeholder,
      .canteen-settings-shell textarea::placeholder { color: var(--settings-text-muted) !important; }
      .canteen-settings-shell button:not(.btn--primary):not(.btn--danger),
      .canteen-settings-shell .btn:not(.btn--primary):not(.btn--danger) { color: var(--settings-text) !important; }
      .canteen-settings-shell [style*='var(--muted)'] { color: var(--settings-text-soft) !important; }
      .canteen-settings-shell :is(
        button,
        .btn,
        .settings-ui-submit,
        .settings-ui-btn,
        .settings-ui-branch-all-btn,
        .settings-ui-branch-clear-btn,
        .canteen-settings-menu-toggle
      ):not(.canteen-settings-home-card):not(.canteen-settings-side-link):not(.qr-theme-card):not(.settings-ui-btn-danger):not(.btn--danger) {
        background: var(--settings-button-bg) !important;
        border-color: var(--settings-button-border) !important;
        color: var(--settings-button-text) !important;
        box-shadow: none !important;
      }
      .canteen-settings-shell :is(
        button,
        .btn,
        .settings-ui-submit,
        .settings-ui-btn,
        .settings-ui-branch-all-btn,
        .settings-ui-branch-clear-btn,
        .canteen-settings-menu-toggle
      ):not(.canteen-settings-home-card):not(.canteen-settings-side-link):not(.qr-theme-card):not(.settings-ui-btn-danger):not(.btn--danger):not(:disabled):not([disabled]):hover {
        background: var(--settings-button-bg-hover) !important;
        border-color: var(--settings-button-bg-hover) !important;
        color: var(--settings-button-text) !important;
      }
      .canteen-settings-shell :is(
        button,
        .btn,
        .settings-ui-submit,
        .settings-ui-btn,
        .settings-ui-branch-all-btn,
        .settings-ui-branch-clear-btn,
        .canteen-settings-menu-toggle
      ):not(.canteen-settings-home-card):not(.canteen-settings-side-link):not(.qr-theme-card):not(.settings-ui-btn-danger):not(.btn--danger):is(:active, .active, .is-active, [data-active="true"]) {
        background: var(--settings-button-bg-active) !important;
        border-color: var(--settings-button-bg-active) !important;
        color: var(--settings-button-text) !important;
      }
      .canteen-settings-shell :is(
        button,
        .btn,
        .settings-ui-submit,
        .settings-ui-btn,
        .settings-ui-branch-all-btn,
        .settings-ui-branch-clear-btn,
        .canteen-settings-menu-toggle
      ):not(.canteen-settings-home-card):not(.canteen-settings-side-link):not(.qr-theme-card):not(.settings-ui-btn-danger):not(.btn--danger):is(:disabled, [disabled], [aria-disabled="true"]) {
        background: var(--settings-button-disabled-bg) !important;
        border-color: var(--settings-button-disabled-border) !important;
        color: var(--settings-button-disabled-text) !important;
        box-shadow: none !important;
      }
      .canteen-settings-menu-toggle {
        min-height: 42px;
        min-width: 42px;
        padding: 0 14px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-weight: 900;
        cursor: pointer;
      }
      .canteen-settings-menu-toggleicon { font-size: 18px; line-height: 1; }
    `}</style>
  )
}

function SettingsTopHeader({ title, subtitle, icon, rightSlot, leftSlot = null, compact = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: compact ? 'wrap' : 'nowrap',
        padding: compact ? '14px 16px' : '18px 20px',
        borderRadius: 24,
        border: '1px solid var(--settings-border)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {leftSlot}
        <div
          style={{
            width: compact ? 44 : 48,
            height: compact ? 44 : 48,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            border: '1px solid var(--settings-border-strong)',
            fontSize: compact ? 16 : 15,
            fontWeight: 900,
            flexShrink: 0
          }}
        >
          <SettingsGlyph icon={icon} size={compact ? 18 : 20} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 18 : 24, fontWeight: 950, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{title}</div>
          {subtitle ? <div style={{ marginTop: 4, fontSize: compact ? 12 : 13, color: 'var(--settings-text-soft)', fontWeight: 700 }}>{subtitle}</div> : null}
        </div>
      </div>
      {rightSlot}
    </div>
  )
}

function SettingsHomePage({ settingsCards, filterOptions, activeFilter, onFilterChange, searchValue, onSearchChange, openSettingsPage, todayLabel, isMobile = false }) {
  return (
    <div style={{ display: 'grid', gap: isMobile ? 10 : 18 }}>
      <section style={{ borderRadius: isMobile ? 18 : 28, border: '1px solid var(--settings-border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))', padding: isMobile ? 10 : 18, boxShadow: 'var(--settings-shadow)' }}>
        <style>{`
          .canteen-settings-home-search {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            align-items: center;
            padding: 10px;
            border-radius: 18px;
            border: 1px solid var(--settings-border);
            background: rgba(255,255,255,0.02);
          }
          .canteen-settings-home-searchbox {
            min-height: 48px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 14px;
            border-radius: 16px;
            border: 1px solid var(--settings-border);
            background: rgba(255,255,255,0.02);
          }
          .canteen-settings-home-searchbox input {
            width: 100%;
            border: 0 !important;
            background: transparent !important;
            outline: 0;
            font-size: 14px;
            font-weight: 800;
            box-shadow: none !important;
          }
          .canteen-settings-home-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
          .canteen-settings-home-chips button {
            min-height: 38px;
            padding: 0 15px;
            border-radius: 999px;
            border: 1px solid var(--settings-border);
            background: rgba(255,255,255,0.05);
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
          }
          .canteen-settings-home-chips button.is-active {
            background: linear-gradient(135deg, var(--settings-accent), var(--settings-accent-2));
            border-color: transparent;
            color: #ffffff !important;
            box-shadow: 0 12px 24px rgba(47,109,246,0.28);
          }
          .canteen-settings-home-grid { margin-top: 16px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
          .canteen-settings-home-card {
            width: 100%;
            display: grid;
            grid-template-rows: auto 1fr auto;
            align-items: start;
            align-content: start;
            gap: 0;
            text-align: left;
            min-height: 168px;
            border-radius: 24px;
            border: 1px solid var(--settings-border);
            background: radial-gradient(circle at top left, rgba(255,255,255,0.04), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
            padding: 16px;
            color: var(--settings-text);
            cursor: pointer;
            transition: border-color .2s ease, background-color .2s ease, color .2s ease;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
          }
          .canteen-settings-home-card > * { min-width: 0; }
          .canteen-settings-home-card:hover {
            border-color: rgba(47,109,246,0.35);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
          }
          .canteen-settings-home-cardtop { display: grid; grid-template-columns: 46px minmax(0, 1fr); align-items: start; gap: 12px; margin-bottom: 14px; min-width: 0; min-height: 46px; }
          .canteen-settings-home-icon {
            width: 46px;
            height: 46px;
            border-radius: 15px;
            display: grid;
            place-items: center;
            background: rgba(255,255,255,0.04);
            border: 1px solid var(--settings-border);
            font-size: 22px;
            flex-shrink: 0;
          }
          .canteen-settings-home-badge {
            justify-self: end;
            padding: 7px 11px;
            border-radius: 999px;
            background: rgba(255,255,255,0.08);
            color: var(--settings-text);
            font-size: clamp(11px, 0.18vw + 10.6px, 12px);
            font-weight: 900;
            line-height: 1.25;
            white-space: normal;
            text-align: center;
            max-width: min(100%, 132px);
            overflow-wrap: anywhere;
          }
          .canteen-settings-home-cardcopy {
            display: grid;
            align-content: start;
            gap: 8px;
            min-width: 0;
          }
          .canteen-settings-home-card h3 { margin: 0; font-size: clamp(15px, 0.48vw + 13.2px, 17px); line-height: 1.15; font-weight: 950; overflow-wrap: anywhere; }
          .canteen-settings-home-card p { margin: 0; color: var(--settings-text-soft); font-size: clamp(12px, 0.24vw + 11.4px, 13px); line-height: 1.5; font-weight: 700; overflow-wrap: anywhere; }
          .canteen-settings-home-link { align-self: end; padding-top: 16px; font-size: clamp(12px, 0.24vw + 11.4px, 13px); font-weight: 900; color: var(--settings-text); line-height: 1.4; overflow-wrap: anywhere; }
          .canteen-settings-home-empty {
            margin-top: 16px;
            padding: 20px;
            border-radius: 20px;
            border: 1px dashed var(--settings-border-strong);
            color: var(--settings-text-soft);
            font-weight: 700;
          }
          @media (max-width: 1480px) {
            .canteen-settings-home-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          }
          @media (max-width: 1240px) {
            .canteen-settings-home-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .canteen-settings-home-search { grid-template-columns: 1fr; }
            .canteen-settings-home-chips { justify-content: flex-start; }
          }
          @media (max-width: 760px) {
            .canteen-settings-home-search {
              padding: 8px;
              border-radius: 16px;
            }
            .canteen-settings-home-searchbox {
              min-height: 44px;
              padding: 0 12px;
              border-radius: 14px;
            }
            .canteen-settings-home-chips {
              gap: 6px;
            }
            .canteen-settings-home-chips button {
              min-height: 36px;
              padding: 0 13px;
              font-size: 11.5px;
            }
            .canteen-settings-home-grid { grid-template-columns: 1fr; }
            .canteen-settings-home-card {
              min-height: 0;
              padding: 14px;
              border-radius: 18px;
            }
            .canteen-settings-home-cardtop {
              margin-bottom: 12px;
            }
            .canteen-settings-home-link {
              margin-top: 14px;
            }
            .canteen-settings-home-empty {
              margin-top: 12px;
              padding: 14px;
              border-radius: 16px;
            }
          }
        `}</style>

        <div className="canteen-settings-home-search">
          <div className="canteen-settings-home-searchbox">
            <span style={{ fontSize: 18 }}>🔍</span>
            <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Ayar adı, açıklama veya kategori ara" />
          </div>

          <div className="canteen-settings-home-chips">
            {filterOptions.map((option) => (
              <button key={option} type="button" className={option === activeFilter ? 'is-active' : ''} onClick={() => onFilterChange(option)}>
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="canteen-settings-home-grid">
          {settingsCards.map((item) => (
            <button key={item.key} type="button" className="canteen-settings-home-card" onClick={() => openSettingsPage(item.to)}>
              <div className="canteen-settings-home-cardtop">
                <div className="canteen-settings-home-icon"><SettingsGlyph icon={item.icon} size={22} /></div>
                <div className="canteen-settings-home-badge">{item.badge}</div>
              </div>

              <div className="canteen-settings-home-cardcopy">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>

              <div className="canteen-settings-home-link">Ayar sayfasını aç →</div>
            </button>
          ))}
        </div>

        {settingsCards.length === 0 ? <div className="canteen-settings-home-empty">Arama veya filtre sonucunda eşleşen ayar bulunamadı.</div> : null}
      </section>
    </div>
  )
}

function DesktopSettingsDetail({ current, sections, onOpen, children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <SettingsTopHeader
        title={current?.label || 'Ayarlar'}
        subtitle={current?.desc || 'Kantin ayarlarını buradan yönetin'}
        icon={current?.icon || 'AY'}
        leftSlot={(
          <button type="button" className="canteen-settings-menu-toggle" onClick={() => setMenuOpen((value) => !value)}>
            <span className="canteen-settings-menu-toggleicon">☰</span>
            <span>{menuOpen ? 'Menüyü Kapat' : 'Menüyü Aç'}</span>
          </button>
        )}
        rightSlot={(
          <button
            type="button"
            onClick={() => onOpen(ROOT_PATH)}
            style={{ minHeight: 42, padding: '0 16px', borderRadius: 16, border: '1px solid var(--settings-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--settings-text)', fontWeight: 900, cursor: 'pointer' }}
          >
            ← Ayarlara Dön
          </button>
        )}
      />

      <style>{`
        .canteen-settings-side-popup {
          position: absolute;
          left: 0;
          top: calc(100% + 12px);
          width: 360px;
          max-width: min(92vw, 360px);
          z-index: 20;
          border-radius: 28px;
          border: 1px solid var(--settings-border);
          background: linear-gradient(180deg, color-mix(in srgb, var(--settings-panel-bg) 98%, transparent), color-mix(in srgb, var(--settings-panel-soft) 98%, transparent));
          padding: 16px;
          box-shadow: 0 24px 56px rgba(0,0,0,0.34);
          backdrop-filter: blur(14px);
        }
        .canteen-settings-side-group + .canteen-settings-side-group {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--settings-border);
        }
        .canteen-settings-side-title {
          margin: 0 0 10px;
          color: var(--settings-text-muted);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .canteen-settings-side-link {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 62px;
          padding: 0 16px;
          border-radius: 20px;
          border: 1px solid var(--settings-border);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          text-align: left;
        }
        .canteen-settings-side-link + .canteen-settings-side-link {
          margin-top: 10px;
        }
        .canteen-settings-side-link.is-active {
          background: var(--settings-side-link-active-bg) !important;
          border-color: var(--settings-side-link-active-border) !important;
          box-shadow: var(--settings-side-link-active-shadow) !important;
        }
        .canteen-settings-side-link.is-active .canteen-settings-side-linkicon {
          background: var(--settings-side-link-active-icon-bg) !important;
          border-color: var(--settings-side-link-active-icon-border) !important;
        }
        .canteen-settings-side-link.is-active .canteen-settings-side-linktitle,
        .canteen-settings-side-link.is-active .canteen-settings-side-linkmeta,
        .canteen-settings-side-link.is-active .canteen-settings-side-linkarrow {
          color: var(--settings-side-link-active-text) !important;
        }
        .canteen-settings-side-linkmain {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .canteen-settings-side-linkicon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          font-size: 18px;
        }
        .canteen-settings-side-linkmeta {
          min-width: 0;
        }
        .canteen-settings-side-linktitle {
          font-size: 15px;
          font-weight: 900;
          color: var(--settings-text);
          overflow-wrap: anywhere;
        }
        .canteen-settings-side-linkdesc {
          margin-top: 3px;
          font-size: 11px;
          font-weight: 700;
          color: var(--settings-text-soft);
        }
        .canteen-settings-side-linkarrow {
          color: var(--settings-text-soft);
          font-size: 18px;
          font-weight: 900;
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ position: 'relative', justifySelf: 'start' }}>
          {menuOpen ? (
            <aside className="canteen-settings-side-popup">
              {sections.map((section) => (
                <div key={section.name} className="canteen-settings-side-group">
                  <div className="canteen-settings-side-title">{section.name}</div>
                  {section.items.map((item) => {
                    const active = item.key === current?.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`canteen-settings-side-link${active ? ' is-active' : ''}`}
                        onClick={() => {
                          onOpen(item.path)
                          setMenuOpen(false)
                        }}
                      >
                        <div className="canteen-settings-side-linkmain">
                          <div className="canteen-settings-side-linkicon"><SettingsGlyph icon={item.icon} size={18} /></div>
                          <div className="canteen-settings-side-linkmeta">
                            <div className="canteen-settings-side-linktitle">{item.label}</div>
                            <div className="canteen-settings-side-linkdesc">{item.desc}</div>
                          </div>
                        </div>
                        <div className="canteen-settings-side-linkarrow">›</div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </aside>
          ) : null}
        </div>

        <section style={{ minWidth: 0, borderRadius: 30, border: '1px solid var(--settings-border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008))', padding: 22, boxShadow: 'var(--settings-shadow)' }}>
          <div>{children}</div>
        </section>
      </div>
    </div>
  )
}

function MobileSettingsDetail({ current, items, onOpen, children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [current?.key])

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <SettingsTopHeader
        title={current?.label || 'Ayarlar'}
        subtitle={current?.desc || 'Kantin ayarlarını düzenleyin'}
        icon={current?.icon || 'AY'}
        compact
        rightSlot={(
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="canteen-settings-menu-toggle" onClick={() => setMenuOpen((value) => !value)}>
              <span className="canteen-settings-menu-toggleicon">☰</span>
            </button>
            <button
              type="button"
              onClick={() => onOpen(ROOT_PATH)}
              style={{ minHeight: 38, padding: '0 12px', borderRadius: 14, border: '1px solid var(--settings-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--settings-text)', fontWeight: 900, fontSize: 12 }}
            >
              ← Ayarlar
            </button>
          </div>
        )}
      />

      {menuOpen ? (
        <div style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 18, border: '1px solid var(--settings-border)', background: 'rgba(255,255,255,0.02)' }}>
          {items.map((item) => {
            const active = item.key === current?.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onOpen(item.path)}
                style={{
                  minHeight: 46,
                  padding: '0 12px',
                  borderRadius: 14,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  border: active ? '0' : '1px solid var(--settings-border)',
                  background: active ? 'linear-gradient(135deg, var(--settings-accent), var(--settings-accent-2))' : 'rgba(255,255,255,0.04)',
                  color: active ? '#ffffff' : 'var(--settings-text)',
                  fontWeight: 900,
                  fontSize: 13
                }}
              >
                <span>{item.label}</span>
                <span>›</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <section style={{ borderRadius: 18, border: '1px solid var(--settings-border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008))', padding: 10 }}>
        {children}
      </section>
    </div>
  )
}

export default function CanteenSettingsLayout() {
  const { pathname } = useLocation()
  const { me, tenantCtx } = useOutletContext()
  const navigate = useNavigate()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const { theme } = useTheme()
  const [searchValue, setSearchValue] = useState('')
  const [activeFilter, setActiveFilter] = useState('Tümü')
  const isExpired = isSubscriptionExpired(tenantCtx)

  const canSettings = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('manage_settings'))
  if (!canSettings) return <div className="card">403 - Bu sayfaya yetkin yok</div>

  const items = useMemo(() => getSettingsItems(isExpired), [isExpired])
  const current = items
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0]
  const isRoot = pathname === ROOT_PATH || pathname === `${ROOT_PATH}/`

  const sections = useMemo(() => {
    const order = ['Hesap', 'İşletme', 'Satış', 'Cihaz', 'Finans', 'Ürün', 'Dijital']
    return order.map((name) => ({ name, items: items.filter((item) => item.section === name) })).filter((section) => section.items.length > 0)
  }, [items])

  const filterOptions = useMemo(() => ['Tümü', ...Array.from(new Set(items.map((item) => item.filterGroup)))], [items])
  const visibleCards = useMemo(() => {
    const normalized = searchValue.trim().toLocaleLowerCase('tr-TR')
    return items.filter((item) => {
      const matchesFilter = activeFilter === 'Tümü' || item.filterGroup === activeFilter
      const matchesSearch = !normalized || [item.label, item.desc, item.filterGroup, item.section].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(normalized))
      return matchesFilter && matchesSearch
    })
  }, [activeFilter, items, searchValue])

  const todayLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
    } catch {
      return ''
    }
  }, [])

  const rootContent = (
    <SettingsHomePage
      settingsCards={visibleCards.map((item) => ({ key: item.key, to: item.path, title: item.label, icon: item.icon, badge: item.filterGroup, desc: item.desc }))}
      filterOptions={filterOptions}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      openSettingsPage={(path) => navigate(path)}
      todayLabel={todayLabel}
      isMobile={isMobilePortrait}
    />
  )

  const shellStyle = {
    ...buildSettingsThemeVars(theme),
    display: 'grid',
    gap: isMobilePortrait ? 10 : 18,
    padding: isMobilePortrait ? 0 : 12,
    borderRadius: isMobilePortrait ? 0 : 30,
    border: isMobilePortrait ? '0' : '1px solid var(--settings-border)',
    background: isMobilePortrait ? 'transparent' : 'linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.008))',
    boxShadow: isMobilePortrait ? 'none' : 'var(--settings-shadow)'
  }

  const detailContent = isMobilePortrait || isTablet
    ? <MobileSettingsDetail current={current} items={items} onOpen={navigate}><Outlet context={{ me, tenantCtx }} /></MobileSettingsDetail>
    : <DesktopSettingsDetail current={current} sections={sections} onOpen={navigate}><Outlet context={{ me, tenantCtx }} /></DesktopSettingsDetail>

  const pageBody = (
    <div className="canteen-settings-shell" style={shellStyle}>
      <SettingsChromeStyle />
      {isRoot ? rootContent : detailContent}
    </div>
  )

  if (isMobilePortrait) return <div className="main pageMobile">{pageBody}</div>
  return <div>{pageBody}</div>
}
