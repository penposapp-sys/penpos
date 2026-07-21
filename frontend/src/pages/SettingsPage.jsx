import React, { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Armchair, Bike, Building2, CreditCard, Package, Printer, QrCode, ReceiptText, Search, Store, UserRound, Users } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useBusinessSettings } from '../context/BusinessSettingsContext.jsx'
import Modal from '../components/Modal.jsx'
import BulkProductsExcelCard from '../components/BulkProductsExcelCard.jsx'
import ThemeSelectionCards from '../components/settings/ThemeSelectionCards.jsx'
import { SettingsToggle, SettingsUiStyles } from '../components/settings/SettingsUi.jsx'
import { PERMISSIONS } from '../constants/permissions.js'
import SettingsBranchCards from '../components/SettingsBranchCards.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { useTheme } from '../theme/ThemeContext.jsx'
import { normalizeThemeId, themeKeys, themes } from '../theme/themeConfig.js'
import { buildSafeBusinessSettings, defaultBusinessSettings, mergeBusinessSettings } from '../lib/businessSettings.js'
import { getSubscriptionStatus } from '../lib/subscription.js'
import { toast } from '../lib/toast.js'
import { resolveApiOrigin } from '../lib/runtimeApi.js'
import { validateProductImageFile } from '../lib/productImage.js'

const BUSINESS_SETTINGS_SECTIONS = {
  general: [
    ['closeCustomerAccounts', 'Cari hesapları ödeme sonrası kapat'],
    ['saveCancelledOrders', 'İptal siparişleri kayıtta tut'],
    ['hideTodoList', 'Yapılacaklar listesini gizle'],
    ['preventStaffOrderingForOthers', 'Personel başkası adına sipariş açamasın'],
    ['requireCancelReason', 'İptalde neden zorunlu olsun'],
    ['askGuestCountOnTableOpen', 'Masa açarken kişi sayısı sor'],
    ['trackCashDrawer', 'Nakit çekmecesi takibi yap'],
  ],
  notifications: [
    ['loopDeliverySound', 'Paket sesi tekrar etsin'],
    ['voiceWarnings', 'Sesli uyarılar açık olsun'],
  ],
  appearance: [
    ['darkMode', 'Koyu tema tercih et'],
    ['colorfulProducts', 'Ürün kartlarını renkli göster'],
    ['animations', 'Geçiş animasyonlarını kullan'],
  ],
  order: [
    ['confirmBeforeAddToCart', 'Sepete eklemeden önce onay sor'],
    ['returnToOpenTablesAfterConfirm', 'İşlem sonrası açık masalara dön'],
    ['addWithoutAskingOptions', 'Ürünü seçenek sormadan ekle'],
    ['askPersonCountOnQuickOrder', 'Hızlı siparişte kişi sayısı sor'],
  ],
  catalogView: [
    ['manualCategorySort', 'Kategori sırasını manuel yönet'],
    ['sortProductsInsideCategory', 'Ürünleri kategori içinde sırala'],
    ['moveOutOfStockToEnd', 'Stokta olmayanları sona taşı'],
    ['hidePassiveProducts', 'Pasif ürünleri gizle'],
    ['showCategoryHeaders', 'Kategori başlıklarını göster'],
    ['showProductImage', 'Ürün görseli göster'],
    ['showProductDescription', 'Ürün açıklaması göster'],
    ['showLargePrice', 'Fiyatı büyük göster'],
  ],
  qrMenu: [
    ['enabled', 'QR menü aktif olsun'],
    ['showLogo', 'Logo göster'],
    ['showCoverImage', 'Kapak görseli göster'],
    ['showPrices', 'Fiyatları göster'],
    ['showDescriptions', 'Açıklamaları göster'],
    ['multiLanguage', 'Çoklu dil desteği'],
    ['waiterCall', 'Garson çağır özelliği'],
    ['tableQrEnabled', 'Masa bazlı QR aktif olsun'],
  ],
}

const SETTINGS_ICONS = {
  search: Search,
  account: UserRound,
  business: Store,
  branches: Building2,
  staff: Users,
  tables: Armchair,
  printers: Printer,
  payments: CreditCard,
  delivery: Bike,
  billing: ReceiptText,
  catalog: Package,
  qr: QrCode,
}

function SettingsIcon({ icon, size = 20, strokeWidth = 2.15 }) {
  const Icon = SETTINGS_ICONS[icon]
  if (!Icon) return <span aria-hidden="true">•</span>
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

function SettingsSwitchGroup({ title, items, values, onToggle }) {
  return (
    <div className="card" style={{ borderColor: 'var(--border)' }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(([key, label]) => (
          <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14 }}>{label}</span>
            <input type="checkbox" checked={!!values?.[key]} onChange={(e) => onToggle(key, e.target.checked)} />
          </label>
        ))}
      </div>
    </div>
  )
}

function ThemeSelector({ selectedThemeName, onSelectThemeName }) {
  const { themeKey, setThemeKey } = useTheme()
  const [localSelectedTheme, setLocalSelectedTheme] = useState(normalizeThemeId(selectedThemeName || themeKey || 'white'))

  useEffect(() => {
    setLocalSelectedTheme(normalizeThemeId(selectedThemeName || themeKey || 'white'))
  }, [selectedThemeName, themeKey])

  const activeThemeName = normalizeThemeId(localSelectedTheme || selectedThemeName || themeKey || 'white')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }}>
      {themeKeys.map((key) => {
        const item = themes[key]
        const selected = activeThemeName === key

        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              setLocalSelectedTheme(key)
              setThemeKey(key)
              onSelectThemeName?.(key)
            }}
            style={{
              borderRadius: 18,
              border: `1px solid ${selected ? 'var(--theme-accent, #0f172a)' : 'var(--app-border, var(--border))'}`,
              background: 'var(--app-surface)',
              color: 'var(--app-text)',
              padding: 12,
              textAlign: 'left',
              cursor: 'pointer',
              appearance: 'none',
              boxShadow: 'none',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ height: 10, borderRadius: 999, background: `linear-gradient(90deg, ${item.accent}, ${item.accentHover || item.accent})` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 900 }}>{item.name}</div>
              {selected && (
                <span style={{ borderRadius: 999, border: '1px solid var(--settings-button-border, var(--app-border))', background: 'var(--settings-button-bg, #111111)', color: 'var(--settings-button-text, #ffffff)', padding: '4px 8px', fontSize: 11, fontWeight: 900 }}>
                  Seçili
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))', lineHeight: 1.45 }}>
              {item.description}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SettingsPageHeader({ title, subtitle, icon, onToggleMenu, onOpenSystemMenu, onBack, rightSlot, isCompact = false }) {
  const controlButtons = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
      {onOpenSystemMenu ? (
        <button
          type="button"
          onClick={onOpenSystemMenu}
          style={{
            height: 40,
            width: 40,
            borderRadius: 14,
            border: '1px solid var(--settings-border)',
            background: 'var(--app-surface)',
            color: 'var(--app-text)',
            fontSize: 18,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 10px 18px rgba(15, 23, 42, 0.08)',
          }}
          aria-label="Sistem menüsünü aç veya kapat"
        >
          ≡
        </button>
      ) : null}

      {onToggleMenu ? (
        <button
          type="button"
          onClick={onToggleMenu}
          style={{
            height: 40,
            width: 40,
            borderRadius: 14,
            border: 'none',
            background: 'var(--theme-accent, #0f172a)',
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 10px 18px rgba(15, 23, 42, 0.16)',
          }}
          aria-label="Ayar menüsünü aç veya kapat"
        >
          ≡
        </button>
      ) : null}

      <div
        style={{
          height: 40,
          minWidth: 40,
          padding: '0 10px',
          borderRadius: 14,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid var(--settings-border)',
          background: 'var(--app-surface)',
          fontWeight: 900,
          color: 'var(--app-text)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  )

  if (isCompact) {
    return (
      <div
        style={{
          borderRadius: 22,
          border: '1px solid var(--settings-border)',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 98%, transparent), var(--settings-panel-soft))',
          padding: '12px',
          marginBottom: 12,
          display: 'grid',
          gap: 12,
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          {controlButtons}
          {rightSlot ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', maxWidth: '100%' }}>{rightSlot}</div> : null}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--app-text)', lineHeight: 1.05, overflowWrap: 'anywhere' }}>
            {title}
          </div>
          {subtitle ? <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 700, marginTop: 4, lineHeight: 1.45 }}>{subtitle}</div> : null}
        </div>

        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              minHeight: 42,
              width: '100%',
              padding: '0 14px',
              borderRadius: 14,
              border: '1px solid var(--settings-border)',
              background: 'var(--settings-button-bg, #111111)',
              color: 'var(--settings-button-text, #ffffff)',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← Ayarlara Dön
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      style={{
        borderRadius: 22,
        border: '1px solid var(--settings-border)',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 98%, transparent), var(--settings-panel-soft))',
        padding: '10px 14px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {controlButtons}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--app-text)', lineHeight: 1.05 }}>
            {title}
          </div>
          {subtitle ? <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 700, marginTop: 3 }}>{subtitle}</div> : null}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {rightSlot}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              minHeight: 40,
              padding: '0 14px',
              borderRadius: 14,
              border: '1px solid var(--settings-border)',
              background: 'var(--settings-button-bg, #111111)',
              color: 'var(--settings-button-text, #ffffff)',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← Ayarlara Dön
          </button>
        ) : null}
      </div>
    </div>
  )
}

function SettingsHomePage({ settingsCards, filterOptions, activeFilter, onFilterChange, searchValue, onSearchChange, openSettingsPage }) {
  return (
    <div className="settings-home">
      <style>{`
        .settings-home { width: 100%; }
        .settings-center-panel {
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          border: 1px solid var(--settings-border);
          border-radius: 24px;
          padding: 14px;
          background:
            radial-gradient(circle at top left, var(--settings-accent-soft-glow), transparent 34%),
            linear-gradient(135deg, var(--app-surface), var(--settings-panel-bg));
          box-shadow: var(--card-shadow);
        }
        .settings-search-row {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) auto;
          align-items: start;
          min-width: 0;
          gap: 14px;
          margin: 0 0 14px;
          padding: 12px;
          border-radius: 20px;
          border: 1px solid var(--settings-border);
          background: color-mix(in srgb, var(--app-surface) 82%, transparent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .settings-search-box {
          flex: 1;
          min-width: 0;
          min-height: 56px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 18px;
          border: 1px solid var(--settings-border);
          border-radius: 20px;
          background: var(--app-input);
        }
        .settings-search-box svg {
          flex-shrink: 0;
          color: var(--app-text-secondary);
        }
        .settings-search-box input {
          border: 0;
          outline: 0;
          min-width: 0;
          width: 100%;
          padding: 0;
          font: inherit;
          font-size: 14px;
          line-height: 1.2;
          font-weight: 700;
          color: var(--app-text);
          background: transparent;
        }
        .settings-filter-list { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; min-width: 0; max-width: 100%; }
        .settings-filter-list button {
          max-width: 100%;
          font: inherit;
          border: 1px solid var(--settings-border);
          border-radius: 999px;
          background: var(--app-button-bg);
          padding: 10px 14px;
          font-weight: 950;
          font-size: 12px;
          color: var(--app-text);
          cursor: pointer;
        }
        .settings-filter-list button.active {
          background: var(--settings-gradient);
          color: #ffffff;
          box-shadow: var(--settings-accent-shadow);
        }
        .settings-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .settings-module-card {
          appearance: none;
          text-align: left;
          border: 1px solid var(--settings-border);
          border-radius: 22px;
          padding: 16px;
          background: linear-gradient(135deg, var(--app-surface), var(--app-surface-soft));
          box-shadow: var(--card-shadow);
          transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
          cursor: pointer;
          color: var(--app-text);
          font: inherit;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          min-width: 0;
          min-height: 188px;
        }
        .settings-module-card:hover {
          transform: none;
          box-shadow: var(--card-shadow);
          border-color: var(--settings-border);
        }
        .settings-module-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; gap: 12px; min-width: 0; }
        .settings-module-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          font-size: 22px;
          background: linear-gradient(135deg, var(--settings-accent-soft), var(--app-surface));
          border: 1px solid var(--settings-border);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
          flex-shrink: 0;
        }
        .settings-module-copy {
          display: grid;
          align-content: start;
          gap: 8px;
          min-width: 0;
          flex: 1 1 auto;
        }
        .settings-module-badge {
          padding: 7px 11px;
          border-radius: 999px;
          background: var(--settings-accent-soft);
          color: var(--settings-accent-text);
          font-size: clamp(11px, 0.18vw + 10.6px, 12px);
          font-weight: 950;
          line-height: 1.25;
          white-space: normal;
          text-align: center;
          max-width: min(100%, 132px);
          overflow-wrap: anywhere;
        }
        .settings-module-card h3 { margin: 0; font-size: clamp(15px, 0.48vw + 13.2px, 17px); font-weight: 950; color: var(--app-text); line-height: 1.25; overflow-wrap: anywhere; }
        .settings-module-card p { min-height: 0; margin: 0; color: var(--app-text-secondary); font-size: clamp(12px, 0.24vw + 11.4px, 13px); font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; }
        .settings-module-link {
          margin-top: auto;
          padding-top: 14px;
          color: var(--settings-accent-text);
          font-size: clamp(12px, 0.24vw + 11.4px, 13px);
          font-weight: 950;
          transition: color 0.2s ease;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .settings-empty-state {
          padding: 24px;
          border-radius: 24px;
          border: 1px solid var(--settings-border);
          background: color-mix(in srgb, var(--app-surface) 88%, transparent);
          color: var(--app-text-secondary);
          font-weight: 700;
        }
        @media (max-width: 1280px) {
          .settings-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .settings-search-row { grid-template-columns: 1fr; }
          .settings-filter-list { justify-content: flex-start; }
        }
        @media (max-width: 768px) {
          .settings-center-panel { padding: 12px; }
          .settings-search-row { padding: 10px; }
          .settings-search-box { min-height: 50px; padding: 0 14px; }
          .settings-filter-list button { padding: 9px 12px; font-size: 11px; }
          .settings-card-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="settings-center-panel">
        <div className="settings-search-row">
          <div className="settings-search-box">
            <SettingsIcon icon="search" />
            <input value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder="Ayar adı, açıklama veya kategori ara" />
          </div>

          <div className="settings-filter-list">
            {filterOptions.map((option) => (
              <button key={option} type="button" className={option === activeFilter ? 'active' : ''} onClick={() => onFilterChange(option)}>
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card-grid">
          {settingsCards.map((item) => (
            <button key={item.key} type="button" className="settings-module-card" onClick={() => openSettingsPage(item.to)}>
              <div className="settings-module-top">
                <div className="settings-module-icon">
                  <SettingsIcon icon={item.icon} size={22} />
                </div>
                <span className="settings-module-badge">{item.group}</span>
              </div>

              <div className="settings-module-copy">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>

              <div className="settings-module-link">Ayar sayfasını aç →</div>
            </button>
          ))}
        </div>

        {settingsCards.length === 0 && (
          <div className="settings-empty-state">Arama veya filtre sonucunda eşleşen ayar kartı bulunamadı.</div>
        )}
      </section>
    </div>
  )
}

export default function SettingsPage() {
  const { user, tenantCtx } = useAuth()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const { isMobilePortrait } = useResponsiveFlags()
  const { theme, isMobileRuntime } = useTheme()
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [settingsSearch, setSettingsSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Tümü')
  const shellTheme = {
    pageBg: 'var(--app-bg)',
    cardBorder: theme.border,
    shadow: 'none',
    accent: theme.accent,
    accentSoft: theme.accentSoft,
    accentText: theme.accentText,
    gradient: theme.gradient,
    panelSoft: isMobileRuntime ? 'var(--app-surface-soft)' : (theme.darkMode ? 'color-mix(in srgb, var(--app-surface-soft) 86%, transparent)' : 'rgba(255,255,255,0.88)')
  }
  const settingsCssVars = {
    '--settings-border': shellTheme.cardBorder,
    '--settings-accent': shellTheme.accent,
    '--settings-accent-soft': shellTheme.accentSoft,
    '--settings-accent-text': shellTheme.accentText,
    '--settings-gradient': shellTheme.gradient,
    '--settings-accent-shadow': 'none',
    '--settings-panel-bg': 'var(--app-surface-soft)',
    '--settings-panel-soft': 'color-mix(in srgb, var(--app-surface-soft) 90%, transparent)',
    '--settings-accent-soft-glow': 'transparent',
    '--settings-button-bg': 'var(--menu-active-bg)',
    '--settings-button-bg-hover': 'var(--menu-active-bg)',
    '--settings-button-bg-active': 'var(--menu-active-bg)',
    '--settings-button-border': 'var(--border-hover)',
    '--settings-button-text': 'var(--sidebar-nav-text-active, #ffffff)',
    '--settings-button-disabled-bg': theme.darkMode ? '#2f2f2f' : '#d1d5db',
    '--settings-button-disabled-border': theme.darkMode ? '#3f3f46' : '#d1d5db',
    '--settings-button-disabled-text': theme.darkMode ? '#9ca3af' : '#6b7280',
  }
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
    []
  )
  const isActive = (p) => pathname.startsWith(p)
  const perms = Array.isArray(user?.permissions) ? user.permissions : []
  const canManageSettings = user?.role === 'tenant_admin' || user?.role === 'superadmin' || perms.includes(PERMISSIONS.MANAGE_SETTINGS)
  const canManageMenu = user?.role === 'tenant_admin' || user?.role === 'superadmin' || perms.includes(PERMISSIONS.MANAGE_MENU)
  const canSee = !!(canManageSettings || canManageMenu)
  const isExpired = getSubscriptionStatus(tenantCtx) === 'expired'

  const basePath = '/kermes/settings'
  const isRoot = pathname === basePath || pathname === basePath + '/'

  const settingsGroups = useMemo(() => {
    const groups = [
      {
        title: 'Hesap',
        items: [{
          key: 'account',
          to: '/kermes/settings/me',
          label: 'Hesabım',
          icon: 'account',
          group: 'İşletme',
          description: 'Giriş bilgileri, şifre ve kullanıcı hesabı'
        }]
      }
    ]

    if (canManageSettings && !isExpired) {
      groups.push({
        title: 'İşletme',
        items: [
          {
            key: 'business',
            to: '/kermes/settings/system',
            label: 'İşletme Ayarları',
            icon: 'business',
            group: 'İşletme',
            description: 'Firma bilgileri, servis, kapanış saati'
          },
          {
            key: 'branches',
            to: '/kermes/settings/branches',
            label: 'Şube Ayarları',
            icon: 'branches',
            group: 'İşletme',
            description: 'Şube listesi, aktiflik ve şubeye bağlı personel'
          },
          {
            key: 'staff',
            to: '/kermes/settings/staff',
            label: 'Personel Ayarları',
            icon: 'staff',
            group: 'Personel',
            description: 'Personel, şifre, yetki ve aktiflik yönetimi'
          },
          {
            key: 'tables',
            to: '/kermes/settings/tables',
            label: 'Masa Ayarları',
            icon: 'tables',
            group: 'Satış',
            description: 'Masa listesi ve oturma düzeni'
          },
          {
            key: 'printers',
            to: '/kermes/settings/printers',
            label: 'Yazıcı Ayarları',
            icon: 'printers',
            group: 'Cihaz',
            description: 'Print Agent, fiş ve etiket yazıcıları'
          },
          {
            key: 'payments',
            to: '/kermes/settings/payments',
            label: 'Ödeme Seçenekleri',
            icon: 'payments',
            group: 'Satış',
            description: 'Nakit, kart, banka ve ek ödeme seçenekleri'
          },
          {
            key: 'delivery',
            to: '/kermes/settings/delivery',
            label: 'Paket Servis',
            icon: 'delivery',
            group: 'Satış',
            description: 'Paket sipariş davranışları ve otomasyonlar'
          },
          ...(user?.role === 'tenant_admin'
            ? [{
                key: 'billing',
                to: '/kermes/settings/billing',
                label: 'Paket & Satın Alma',
                icon: 'billing',
                group: 'Finans',
                description: 'Abonelik, paket ve satın alma yönetimi'
              }]
            : []),
        ]
      })
    }

    if (canManageMenu && !isExpired) {
      groups.push({
        title: 'Menü',
        items: [
          {
            key: 'catalog',
            to: '/kermes/settings/catalog',
            label: 'Ürün & Kategori',
            icon: 'catalog',
            group: 'Ürün',
            description: 'Ürün, kategori, görünüm ve sıralama ayarları'
          },
          {
            key: 'qr',
            to: '/kermes/settings/qr',
            label: 'QR Menü',
            icon: 'qr',
            group: 'Dijital',
            description: 'Public menü, QR indir, masa QR ve görünüm'
          },
          {
            key: 'online-sales',
            to: '/kermes/settings/online-sales',
            label: 'Online Satış',
            icon: 'delivery',
            group: 'Dijital',
            description: 'Public sipariş yüzeyi, hedef şube ve paket akışı'
          },
          {
            key: 'website',
            to: '/kermes/settings/website',
            label: 'Web Site Ayarları',
            icon: 'business',
            group: 'Dijital',
            description: 'Bu sayfa henüz hazırlanmadı'
          },
        ]
      })
    }

    if (isExpired && user?.role === 'tenant_admin') {
      groups.push({
        title: 'Abonelik',
        items: [{
          key: 'billing',
          to: '/kermes/settings/billing',
          label: 'Paket & Satın Alma',
          icon: 'billing',
          group: 'Finans',
          description: 'Plan yükseltme ve ödeme adımları'
        },
        {
          key: 'website',
          to: '/kermes/settings/website',
          label: 'Web Site Ayarları',
          icon: 'business',
          group: 'Dijital',
          description: 'Bu sayfa henüz hazırlanmadı'
        }]
      })
    }

    return groups
  }, [canManageMenu, canManageSettings, isExpired, user?.role])

  const menu = useMemo(() => settingsGroups.flatMap((group) => group.items), [settingsGroups])
  const settingsCards = useMemo(() => menu.map((item) => ({
    key: item.key,
    to: item.to,
    title: item.label,
    desc: item.description,
    icon: item.icon,
    group: item.group,
  })), [menu])
  const filterOptions = useMemo(() => {
    const options = ['Tümü', ...new Set(settingsCards.map((item) => item.group).filter(Boolean))]
    return options
  }, [settingsCards])
  const filteredCards = useMemo(() => {
    const needle = settingsSearch.trim().toLocaleLowerCase('tr')
    return settingsCards.filter((item) => {
      const matchesFilter = activeFilter === 'Tümü' || item.group === activeFilter
      if (!matchesFilter) return false
      if (!needle) return true
      const haystack = [item.title, item.desc, item.group]
        .join(' ')
        .toLocaleLowerCase('tr')
      return haystack.includes(needle)
    })
  }, [activeFilter, settingsCards, settingsSearch])

  const current = useMemo(() => {
    return menu
      .filter(i => pathname === i.to || pathname.startsWith(i.to + '/'))
      .sort((a, b) => b.to.length - a.to.length)[0]
  }, [menu, pathname])

  useEffect(() => {
    setSettingsMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const root = document.querySelector('.page-scroll-area')
    if (root) root.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  const openSettingsPage = (pagePath) => {
    nav(pagePath)
    setSettingsMenuOpen(false)
  }

  const goSettingsHome = () => {
    nav('/kermes/settings')
    setSettingsMenuOpen(false)
  }

  const openSystemMenu = () => {
    try {
      window.dispatchEvent(new Event('layout:toggle-mobile-menu'))
    } catch {}
  }

  if (isMobilePortrait) {
    if (isRoot) {
      return (
        <div className="main pageMobile settings-scope" style={{ display: 'grid', gap: 16, ...settingsCssVars }}>
          <SettingsPageHeader
            title="Ayarlar"
            subtitle="Ayar bölümlerini buradan yönetin"
            icon="AY"
            isCompact
            onOpenSystemMenu={openSystemMenu}
            rightSlot={
              <div style={{ minHeight: 40, padding: '0 14px', borderRadius: 14, border: '1px solid var(--settings-border)', background: 'var(--app-surface)', color: 'var(--app-text)', fontWeight: 900, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                {todayLabel}
              </div>
            }
          />
          {!canSee ? (
            <div className="card">Bu sayfaya yetkin yok</div>
          ) : (
            <SettingsHomePage
              settingsCards={filteredCards}
              filterOptions={filterOptions}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              searchValue={settingsSearch}
              onSearchChange={setSettingsSearch}
              openSettingsPage={openSettingsPage}
            />
          )}
        </div>
      )
    }

    return (
      <div className="main pageMobile settings-scope" style={{ display: 'grid', gap: 10, position: 'relative', overflowX: 'hidden', padding: 0, ...settingsCssVars }}>
        <SettingsPageHeader
          title={current?.label || 'Ayarlar'}
          subtitle={current?.description || ''}
          icon={current?.icon ? <SettingsIcon icon={current.icon} size={18} /> : 'AY'}
          isCompact
          onOpenSystemMenu={openSystemMenu}
          onToggleMenu={() => setSettingsMenuOpen((value) => !value)}
          onBack={goSettingsHome}
        />
        {settingsMenuOpen && (
          <aside
            style={{
              borderRadius: 22,
              border: `1px solid ${shellTheme.cardBorder}`,
              background: 'color-mix(in srgb, var(--app-surface) 94%, transparent)',
              padding: 12,
              boxShadow: '0 18px 36px rgba(15, 23, 42, 0.12)',
              display: 'grid',
              gap: 12,
            }}
          >
            {settingsGroups.map((group) => (
              <div key={group.title} style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--app-text-muted, var(--muted))' }}>
                  {group.title}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => openSettingsPage(item.to)}
                    style={{
                      width: '100%',
                      minHeight: 56,
                      borderRadius: 18,
                      border: `1px solid ${pathname === item.to || pathname.startsWith(item.to + '/') ? shellTheme.accent : 'var(--settings-border)'}`,
                      background: pathname === item.to || pathname.startsWith(item.to + '/')
                        ? shellTheme.gradient
                        : 'linear-gradient(135deg, var(--app-surface), var(--app-surface-soft))',
                      color: pathname === item.to || pathname.startsWith(item.to + '/') ? '#ffffff' : 'var(--app-text)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'grid', placeItems: 'center' }}>
                        <SettingsIcon icon={item.icon} size={18} />
                      </span>
                      <span>{item.label}</span>
                    </span>
                    <span>›</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>
        )}
        <div style={{ minWidth: 0, overflowX: 'hidden' }}>
          <Outlet />
        </div>
      </div>
    )
  }

  return (
    <div className="settings-scope" style={{ padding: 8, background: shellTheme.pageBg, borderRadius: 24, border: `1px solid ${shellTheme.cardBorder}`, boxShadow: '0 18px 40px rgba(148, 163, 184, 0.12)', position: 'relative', minWidth: 0, maxWidth: '100%', overflowX: 'hidden', ...settingsCssVars }}>
      <div style={{ borderRadius: 20, border: `1px solid ${shellTheme.cardBorder}`, background: 'color-mix(in srgb, var(--app-surface) 76%, transparent)', backdropFilter: 'blur(10px)', padding: 10, boxShadow: shellTheme.shadow, minHeight: 420, minWidth: 0, overflowX: 'hidden' }}>
        {isRoot ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <SettingsPageHeader
              title="Ayarlar"
              subtitle="Ayar bölümlerini buradan yönetin"
              icon="AY"
              rightSlot={
                <div style={{ minHeight: 40, padding: '0 14px', borderRadius: 14, border: '1px solid var(--settings-border)', background: 'var(--app-surface)', color: 'var(--app-text)', fontWeight: 900, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                  {todayLabel}
                </div>
              }
            />
            <SettingsHomePage
              settingsCards={filteredCards}
              filterOptions={filterOptions}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              searchValue={settingsSearch}
              onSearchChange={setSettingsSearch}
              openSettingsPage={openSettingsPage}
            />
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'grid', gap: 12, minWidth: 0 }}>
            <SettingsPageHeader
              title={current?.label || 'Ayarlar'}
              subtitle={current?.description || ''}
              icon={current?.icon ? <SettingsIcon icon={current.icon} size={18} /> : 'AY'}
              onToggleMenu={() => setSettingsMenuOpen((value) => !value)}
              onBack={goSettingsHome}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: settingsMenuOpen ? 'minmax(260px, 300px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
                gap: 12,
                alignItems: 'start',
                minWidth: 0,
              }}
            >
              {settingsMenuOpen && (
                <aside
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    borderRadius: 30,
                    border: `1px solid ${shellTheme.cardBorder}`,
                    background: 'color-mix(in srgb, var(--app-surface) 94%, transparent)',
                    padding: 16,
                    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.16)',
                    display: 'grid',
                    gap: 16,
                    minWidth: 0,
                  }}
                >
                  {settingsGroups.map((group) => (
                    <div key={group.title} style={{ display: 'grid', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--app-text-muted, var(--muted))' }}>
                        {group.title}
                      </div>
                      {group.items.map((item) => (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => openSettingsPage(item.to)}
                          style={{
                            width: '100%',
                            minHeight: 56,
                            borderRadius: 18,
                            border: `1px solid ${isActive(item.to) ? shellTheme.accent : 'var(--settings-border)'}`,
                            background: isActive(item.to)
                              ? shellTheme.gradient
                              : 'linear-gradient(135deg, var(--app-surface), var(--app-surface-soft))',
                            color: isActive(item.to) ? '#ffffff' : 'var(--app-text)',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ display: 'grid', placeItems: 'center' }}>
                              <SettingsIcon icon={item.icon} size={18} />
                            </span>
                            <span>{item.label}</span>
                          </span>
                          <span>›</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </aside>
              )}

              <div style={{ minWidth: 0 }}>
                <Outlet />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const SettingsSystemContent = () => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [allowedBranchIds, setAllowedBranchIdsLocal] = useState([])
  const [selectedThemeId, setSelectedThemeId] = useState(normalizeThemeId(defaultBusinessSettings.appearance.themeId))
  const [selectedDarkMode, setSelectedDarkMode] = useState(defaultBusinessSettings.appearance.darkMode)
  const [savedThemeId, setSavedThemeId] = useState(normalizeThemeId(defaultBusinessSettings.appearance.themeId))
  const [savedDarkMode, setSavedDarkMode] = useState(defaultBusinessSettings.appearance.darkMode)
  const [loading, setLoading] = useState(false)
  const [branchSaving, setBranchSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { refresh, setAllowedBranchIds } = useAuth()
  const { setSettingsLocally } = useBusinessSettings()
  const { isMobileRuntime, setThemeKey, setDarkMode } = useTheme()

  const apiOrigin = React.useMemo(() => resolveApiOrigin(), [])
  const activeBranches = React.useMemo(
    () => (Array.isArray(branches) ? branches.filter((branch) => branch?.isActive !== false) : []),
    [branches]
  )
  const activeBranchIdSet = React.useMemo(
    () => new Set(activeBranches.map((branch) => String(branch?._id || branch?.id || '')).filter(Boolean)),
    [activeBranches]
  )
  const sanitizedAllowedBranchIds = React.useMemo(
    () => (Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String).filter((id) => activeBranchIdSet.has(String(id))) : []),
    [allowedBranchIds, activeBranchIdSet]
  )

  const logoPreviewSrc = React.useMemo(() => {
    const raw = String(logoUrl || '').trim()
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    return `${apiOrigin}${raw.startsWith('/') ? '' : '/'}${raw}`
  }, [logoUrl, apiOrigin])

  const load = async () => {
    setError('')
    const [profileRes, businessRes, branchesRes] = await Promise.all([
      api('/api/tenant/profile', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
      api('/api/settings/business', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
      api('/api/branches', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
    ])

    if (profileRes?.success === false) {
      setName('')
      setDescription('')
      setAllowedBranchIds([])
      setBranches([])
      setError(profileRes.message || 'Bu işlem için yetkiniz yok')
      return
    }
    const t = profileRes?.tenant || null
    const nextThemeId = normalizeThemeId(businessRes?.settings?.appearance?.themeId || defaultBusinessSettings.appearance.themeId)
    const nextDarkMode = businessRes?.settings?.appearance?.darkMode === true
    setName(t?.name || '')
    setDescription(t?.description || '')
    setLogoUrl(t?.logoUrl || '')
    const nextBranches = Array.isArray(branchesRes?.branches) ? branchesRes.branches : []
    const nextActiveBranchIds = new Set(
      nextBranches
        .filter((branch) => branch?.isActive !== false)
        .map((branch) => String(branch?._id || branch?.id || ''))
        .filter(Boolean)
    )
    setAllowedBranchIdsLocal(
      Array.isArray(t?.allowedBranchIds)
        ? t.allowedBranchIds.map(String).filter((id) => nextActiveBranchIds.has(String(id)))
        : []
    )
    setSelectedThemeId(nextThemeId)
    setSelectedDarkMode(nextDarkMode)
    setSavedThemeId(nextThemeId)
    setSavedDarkMode(nextDarkMode)
    setThemeKey(nextThemeId)
    setDarkMode(nextDarkMode)

    if (branchesRes?.success === false) {
      setBranches([])
      return
    }
    setBranches(nextBranches)
  }
  useEffect(() => { load() }, [])

  const toggleAllowedBranch = (branchId, checked) => {
    const set = new Set(Array.isArray(allowedBranchIds) ? allowedBranchIds : [])
    if (checked) set.add(String(branchId))
    else set.delete(String(branchId))
    setAllowedBranchIdsLocal(Array.from(set))
  }

  const persistAllowedBranches = async () => {
    setBranchSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await api('/api/tenant/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, description, allowedBranchIds: sanitizedAllowedBranchIds }),
        silent: true,
        skipBranchHeader: true
      })

      if (res?.success === false) {
        setError(res.message || 'Yetkili şubeler kaydedilemedi')
        return
      }

      try {
        const nextAllowed = Array.isArray(res?.tenant?.allowedBranchIds) ? res.tenant.allowedBranchIds.map(String).filter((id) => activeBranchIdSet.has(String(id))) : []
        setAllowedBranchIdsLocal(nextAllowed)
        setAllowedBranchIds(nextAllowed)
        window.dispatchEvent(new CustomEvent('allowed_branches_changed', { detail: { allowedBranchIds: nextAllowed } }))
      } catch {}

      setSuccess('Yetkili şubeler kaydedildi')
      await load()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBranchSaving(false)
    }
  }

  const onSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const [profileSaveRes, businessSaveRes] = await Promise.all([
        api('/api/tenant/profile', {
          method: 'PUT',
          body: JSON.stringify({ name, description, allowedBranchIds: sanitizedAllowedBranchIds }),
          silent: true,
          skipBranchHeader: true
        }),
        api('/api/settings/business', {
          method: 'PUT',
          body: JSON.stringify({
            settings: {
              appearance: {
                themeId: selectedThemeId,
                darkMode: selectedDarkMode,
              },
            },
          }),
          silent: true,
          skipBranchHeader: true,
        }),
      ])

      const res = profileSaveRes
      const businessRes = businessSaveRes

      if (res?.success === false) {
        setError(res.message || 'Bu işlem için yetkiniz yok')
        return
      }
      if (businessRes?.success === false) {
        setError(businessRes.message || 'Tema ayarları kaydedilemedi')
        return
      }

      const nextThemeId = normalizeThemeId(businessRes?.settings?.appearance?.themeId || selectedThemeId || defaultBusinessSettings.appearance.themeId)
      const nextDarkMode = businessRes?.settings?.appearance?.darkMode === true
      setSelectedThemeId(nextThemeId)
      setSelectedDarkMode(nextDarkMode)
      setSavedThemeId(nextThemeId)
      setSavedDarkMode(nextDarkMode)
      setThemeKey(nextThemeId)
      setDarkMode(nextDarkMode)
      setSettingsLocally({
        appearance: {
          themeId: nextThemeId,
          darkMode: nextDarkMode,
        },
      })

      try {
        const nextAllowed = Array.isArray(res?.tenant?.allowedBranchIds) ? res.tenant.allowedBranchIds.map(String).filter((id) => activeBranchIdSet.has(String(id))) : []
        setAllowedBranchIdsLocal(nextAllowed)
        setAllowedBranchIds(nextAllowed)
        window.dispatchEvent(new CustomEvent('allowed_branches_changed', { detail: { allowedBranchIds: nextAllowed } }))
      } catch {}
      setSuccess('Kaydedildi')
      await load()
      await refresh()
      return
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleThemeSelect = (themeId) => {
    setSelectedThemeId(themeId)
    setThemeKey(themeId)
  }

  const handleDarkModeToggle = (nextDarkMode) => {
    setSelectedDarkMode(Boolean(nextDarkMode))
    setDarkMode(Boolean(nextDarkMode))
  }

  const uploadLogo = async () => {
    if (!logoFile) return
    const validationMessage = validateProductImageFile(logoFile)
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    setLogoLoading(true)
    setError('')
    setSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', logoFile)
      const res = await api('/api/settings/logo', { method: 'POST', body: fd, silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setError(res.message || 'Logo yüklenemedi')
        return
      }
      setLogoUrl(res?.logoUrl || '')
      setLogoFile(null)
      setSuccess('Logo yüklendi')
    } catch (err) {
      setError(err.message || 'Logo yüklenemedi')
    } finally {
      setLogoLoading(false)
    }
  }

  const removeLogo = async () => {
    setLogoLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api('/api/settings/logo', { method: 'DELETE', silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setError(res.message || 'Logo kaldırılamadı')
        return
      }
      setLogoUrl('')
      setLogoFile(null)
      setSuccess('Logo kaldırıldı')
    } catch (err) {
      setError(err.message || 'Logo kaldırılamadı')
    } finally {
      setLogoLoading(false)
    }
  }

  return (
    <div>
      <SettingsUiStyles />
      <h3 style={{ marginTop: 0 }}>Sistem Ayarları</h3>
      <form onSubmit={onSave} style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
        <div className="card" style={{ borderColor: 'var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Genel</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>İşletme Adı</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
              <textarea className="input" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Restoran Logosu</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--app-surface)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {logoPreviewSrc ? (
                <img src={logoPreviewSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Logo yok</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 8 }}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] || null
                  const validationMessage = validateProductImageFile(nextFile)
                  setLogoFile(validationMessage ? null : nextFile)
                  setError(validationMessage || '')
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>PNG/JPG/WebP, max 5MB. Otomatik olarak 800x800 WebP optimize edilir.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn" disabled={!logoFile || logoLoading} onClick={uploadLogo}>
                {logoLoading ? 'Yükleniyor...' : 'Logo Yükle'}
              </button>
              <button type="button" className="btn" disabled={!logoUrl || logoLoading} onClick={removeLogo}>
                Kaldır
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'var(--border)' }}>
          <div style={{ fontWeight: 800 }}>Yetkili Şubeler</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            POS/Walk-in/Delivery için şube seçimi altyapısı. Birden fazla şube seçilebilir.
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {activeBranches.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Şube bulunamadı</div>
            ) : (
              activeBranches.map((b) => (
                <SettingsToggle
                  key={b._id || b.id}
                  label={b.name}
                  description={b.description || b.address || 'Bu sube isletme yetki alanina dahil edilir.'}
                  checked={allowedBranchIds.includes(String(b._id || b.id))}
                  onChange={(e) => toggleAllowedBranch((b._id || b.id), e.target.checked)}
                />
              ))
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={persistAllowedBranches} disabled={loading || branchSaving}>
              {branchSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Gorunum Modu</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Bu paneli beyaz mod veya koyu mod olarak kullanin.
          </div>
          <ThemeSelectionCards
            darkMode={selectedDarkMode}
            onToggleDarkMode={handleDarkModeToggle}
          />
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
        {success && <div style={{ color: '#22c55e', fontSize: 13 }}>{success}</div>}
        <button className="btn" disabled={loading || (selectedThemeId === savedThemeId && selectedDarkMode === savedDarkMode)}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </form>
    </div>
  )
}

export const SettingsMenuHub = () => {
  const { user } = useAuth()
  const canBulk = user?.role === 'tenant_admin' || (Array.isArray(user?.permissions) && user.permissions.includes(PERMISSIONS.MANAGE_MENU))
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Ürün ve Kategori Ayarları</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Kategoriler</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori ekleme/düzenleme/pasifleştirme</div>
          </div>
          <Link className="btn" to="/kermes/settings/menu/categories">Kategorileri Yönet</Link>
        </div>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Ürünler</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürün ekleme/düzenleme/pasifleştirme</div>
          </div>
          <Link className="btn" to="/kermes/settings/menu/items">Ürünleri Yönet</Link>
        </div>
        {canBulk && <BulkProductsExcelCard />}
      </div>
    </div>
  )
}

export const SettingsTablesContent = () => {
  const nav = useNavigate()
  const { search } = useLocation()
  const [tablesByBranchId, setTablesByBranchId] = useState({})
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ baseName: 'Masa', count: 1 })
  const [editForm, setEditForm] = useState({ name: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const { user, tenantCtx } = useAuth()
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const isExpired = getSubscriptionStatus(tenantCtx) === 'expired'
  const [createErrors, setCreateErrors] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')

  const branchNameById = React.useMemo(() => {
    const m = new Map()
    for (const b of (Array.isArray(branches) ? branches : [])) {
      const id = String(b?.id || b?._id || '').trim()
      if (id) m.set(id, b?.name || '')
    }
    return m
  }, [branches])

  const parseBranchIdFromSearch = () => {
    try {
      const params = new URLSearchParams(String(search || ''))
      const v = params.get('branchId')
      return v ? String(v) : ''
    } catch {
      return ''
    }
  }

  const syncUrl = (next) => {
    try {
      const params = new URLSearchParams(String(search || ''))
      if (!next) params.delete('branchId')
      else params.set('branchId', String(next))
      const qs = params.toString()
      nav({ pathname: '/kermes/settings/tables', search: qs ? `?${qs}` : '' }, { replace: true })
    } catch {}
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const branchesRes = await api('/api/tenant/branches', { silent: true, skipBranchHeader: true })
      const list = Array.isArray(branchesRes?.branches) ? branchesRes.branches : []
      setBranches(list)

      const localBranchNameById = new Map()
      for (const b of list) {
        const id = String(b?.id || b?._id || '').trim()
        if (id) localBranchNameById.set(id, b?.name || '')
      }

      const byBranch = {}
      const results = await Promise.allSettled(
        list.map(async (b) => {
          const id = String(b?.id || b?._id || '').trim()
          if (!id) return
          const res = await api('/api/tenant/tables', { silent: true, skipBranchHeader: true, headers: { 'x-branch-id': id } })
          byBranch[id] = Array.isArray(res?.tables) ? res.tables : []
        })
      )
      const failed = results.some(r => r.status === 'rejected')
      setTablesByBranchId(byBranch)

      const fromUrl = parseBranchIdFromSearch()
      const validIds = list.map(b => String(b?.id || b?._id || '').trim()).filter(Boolean)
      const nextSelected = fromUrl && (fromUrl === 'all' || validIds.includes(fromUrl))
        ? fromUrl
        : (validIds[0] || '')

      setSelectedBranchId(nextSelected)
      if (nextSelected && nextSelected !== fromUrl) syncUrl(nextSelected)

      if (!nextSelected) {
        setItems([])
      } else if (nextSelected === 'all') {
        const merged = Object.values(byBranch).flat().sort((a, b) => {
          const aBid = String(a?.branchId || '')
          const bBid = String(b?.branchId || '')
          const aBn = localBranchNameById.get(aBid) || ''
          const bBn = localBranchNameById.get(bBid) || ''
          const byBranch = aBn.localeCompare(bBn, 'tr')
          if (byBranch !== 0) return byBranch
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
        })
        setItems(merged)
      } else {
        setItems(Array.isArray(byBranch[nextSelected]) ? byBranch[nextSelected] : [])
      }

      if (failed) {
        setError('Bazı şubelerin masaları alınamadı. Tekrar deneyin.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const fromUrl = parseBranchIdFromSearch()
    if (!fromUrl) return
    if (fromUrl === selectedBranchId) return
    const ids = (branches || []).map(b => String(b?.id || b?._id || '').trim()).filter(Boolean)
    if (fromUrl === 'all' || ids.includes(fromUrl)) {
      setSelectedBranchId(fromUrl)
      if (fromUrl === 'all') {
        const merged = Object.values(tablesByBranchId || {}).flat().sort((a, b) => {
          const aBid = String(a?.branchId || '')
          const bBid = String(b?.branchId || '')
          const aBn = branchNameById.get(aBid) || ''
          const bBn = branchNameById.get(bBid) || ''
          const byBranch = aBn.localeCompare(bBn, 'tr')
          if (byBranch !== 0) return byBranch
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
        })
        setItems(merged)
      } else {
        setItems(Array.isArray(tablesByBranchId?.[fromUrl]) ? tablesByBranchId[fromUrl] : [])
      }
    }
  }, [search, branches, tablesByBranchId, selectedBranchId])

  const onSelectBranch = (id) => {
    const next = String(id || '').trim()
    setSelectedBranchId(next)
    syncUrl(next)
    if (!next) {
      setItems([])
      return
    }
    if (next === 'all') {
      const merged = Object.values(tablesByBranchId || {}).flat().sort((a, b) => {
        const aBid = String(a?.branchId || '')
        const bBid = String(b?.branchId || '')
        const aBn = branchNameById.get(aBid) || ''
        const bBn = branchNameById.get(bBid) || ''
        const byBranch = aBn.localeCompare(bBn, 'tr')
        if (byBranch !== 0) return byBranch
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
      })
      setItems(merged)
      return
    }
    setItems(Array.isArray(tablesByBranchId?.[next]) ? tablesByBranchId[next] : [])
  }

  const openCreate = () => {
    setCreateForm({ baseName: 'Masa', count: 1 })
    setFormError('')
    const next = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : ''
    setBranchId(next)
    setCreateErrors([])
    setCreateOpen(true)
  }
  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const base = String(createForm.baseName || '').trim()
      const cnt = Math.max(1, Number(createForm.count) || 1)
      if (!branchId) {
        setFormError('Şube seçiniz')
        setFormLoading(false)
        return
      }
      const names = Array(cnt).fill(0).map((_, i) => `${base} ${i + 1}`)
      const created = []
      const errors = []
      for (let i = 0; i < names.length; i++) {
        try {
          const body = user?.role === 'tenant_admin' ? { name: names[i], branchId } : { name: names[i] }
          const { table } = await api('/api/tenant/tables', { method: 'POST', body: JSON.stringify(body) })
          created.push(table)
        } catch (err) {
          errors.push({ name: names[i], message: err.message })
        }
      }
      if (created.length > 0) {
        await load()
        try {
          await api('/api/tenant/audit', { method: 'POST', body: JSON.stringify({ action: 'masa_toplu_eklendi', entityType: 'Table', entityId: created[0]?.id || '', meta: { count: created.length, baseName: base } }) })
        } catch {}
      }
      setCreateErrors(errors)
      if (errors.length === 0) {
        setCreateOpen(false)
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (t) => {
    setSelected(t)
    setEditForm({ name: t.name })
    setFormError('')
    setEditOpen(true)
  }
  const onEdit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { table } = await api(`/api/tenant/tables/${selected.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      await load()
      setEditOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const onDisable = async (t) => {
    try {
      await api(`/api/tenant/tables/${t.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Masa Ayarları</h3>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
            Bu ekran yalnızca masa tanımı yönetimi içindir (ekle/düzenle/sil). Sipariş ekranı değildir.
          </div>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
          <button className="btn" onClick={openCreate} disabled={isExpired} title={isExpired ? 'Paket süreniz doldu. Plan yükseltin.' : undefined}>Masa Ekle</button>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni masa tanımı oluştur</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <SettingsBranchCards
          branches={branches}
          tablesByBranchId={tablesByBranchId}
          selectedBranchId={selectedBranchId}
          onSelectBranchId={onSelectBranch}
          showAll
        />
      </div>

      {!selectedBranchId && (
        <div className="card" style={{ borderColor: '#ef4444', background: 'color-mix(in srgb, #ef4444 14%, var(--app-surface))', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Şube seçilmedi. Lütfen yukarıdan şube seçin.</div>
        </div>
      )}
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {loading ? 'Yükleniyor...' : (
        items.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>{selectedBranchId === 'all' ? 'Henüz masa tanımı yok.' : 'Bu şube için masa bulunamadı.'}</div>
        ) : (
          <>
            <div className="desktop-only">
              <table className="table">
                <thead>
                  <tr><th>Ad</th><th>Şube</th><th>Durum</th><th className="actions" style={{ width: 240 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map(t => {
                    const branchLabel = branchNameById.get(String(t.branchId || '')) || '-'
                    const statusLabel = t.isActive === false ? 'Pasif' : 'Aktif'
                    const disableDisabled = t.status === 'occupied'
                    const disableTitle = disableDisabled ? 'Kullanımda masa silinemez' : undefined
                    return (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{branchLabel}</td>
                        <td>{statusLabel}</td>
                        <td className="actions">
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => openEdit(t)}>Düzenle</button>
                            <button className="btn" onClick={() => onDisable(t)} disabled={disableDisabled} title={disableTitle}>Sil</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only settings-mobile">
              {(items || []).map(t => {
                const branchLabel = branchNameById.get(String(t.branchId || '')) || '-'
                const statusLabel = t.isActive === false ? 'Pasif' : 'Aktif'
                const disableDisabled = t.status === 'occupied'
                const disableTitle = disableDisabled ? 'Kullanımda masa silinemez' : undefined
                return (
                  <div key={t.id} className="mobile-list-item">
                    <div className="mobile-item-title breakAny">{t.name}</div>
                    <div className="mobile-item-meta">
                      <span className="breakAny">Şube: {branchLabel}</span>
                      <span>Durum: {statusLabel}</span>
                    </div>
                    <div className="mobile-actions-row">
                      <button className="btn" type="button" onClick={() => openEdit(t)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => onDisable(t)} disabled={disableDisabled} title={disableTitle}>Sil</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Masa Ekle">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Başlangıç Masa Adı</div>
            <input className="input" value={createForm.baseName} onChange={(e) => setCreateForm({ ...createForm, baseName: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Masa Adedi</div>
            <input className="input" type="number" min="1" value={createForm.count} onChange={(e) => setCreateForm({ ...createForm, count: Number(e.target.value) })} />
          </label>
          {(selectedBranchId && selectedBranchId !== 'all') ? (
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şube</div>
              <input className="input" value={branchNameById.get(String(selectedBranchId)) || ''} disabled />
            </label>
          ) : (
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şube</div>
              <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Şube seçiniz</option>
                {(branches || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          {createErrors.length > 0 && (
            <div style={{ fontSize: 13 }}>
              {createErrors.map((er, idx) => (
                <div key={idx} style={{ color: '#ef4444' }}>{er.name}: {er.message}</div>
              ))}
            </div>
          )}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Kaydediliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Masa Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>
    </div>
  )
}

export const SettingsPaymentsContent = ({ showHeading = true } = {}) => {
  const { isMobilePortrait } = useResponsiveFlags()
  const [methods, setMethods] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addingName, setAddingName] = useState('')
  const [editingId, setEditingId] = useState('')

  const sortMethods = (list) => [...(Array.isArray(list) ? list : [])]
    .sort((a, b) => (Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)) || String(a?.name || '').localeCompare(String(b?.name || ''), 'tr'))

  const normalizeMethods = (payload) => sortMethods(payload?.paymentMethods || [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/api/settings/payment-methods', { silent: true, cacheMode: 'no-store' })
      setMethods(normalizeMethods(result))
    } catch (err) {
      setError(err.message)
      setMethods([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const setMethodValue = (id, updater) => {
    setMethods((current) => sortMethods(current.map((method) => {
      if (String(method?.id) !== String(id)) return method
      return typeof updater === 'function' ? updater(method) : { ...method, ...updater }
    })))
  }

  const toggleEnabled = (id) => {
    setError('')
    setMethods((current) => {
      const list = sortMethods(current)
      const next = list.map((method) => ({ ...method }))
      const index = next.findIndex((method) => String(method?.id) === String(id))
      if (index === -1) return list
      const target = next[index]
      if (String(target?.id) === 'credit') return list
      target.enabled = !target.enabled
      return next
    })
  }

  const updateName = (id, name) => {
    setError('')
    setMethodValue(id, { name })
  }

  const addMethod = async () => {
    const name = String(addingName || '').trim()
    if (!name) {
      setError('Yeni ödeme seçeneği için isim girin.')
      return
    }
    if (methods.some((method) => method.isDeleted !== true && String(method.name || '').trim().toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) {
      setError('Aynı isimde aktif ödeme yöntemi olamaz.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await api('/api/settings/payment-methods', { method: 'POST', data: { name }, silent: true })
      setMethods(normalizeMethods(result))
      setAdding(false)
      setAddingName('')
      toast.success('Ödeme seçeneği eklendi')
    } catch (err) {
      setError(err.message)
      toast.error(err.message || 'Ödeme seçeneği eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  const removeMethod = async (method) => {
    if (!method) return
    const confirmed = window.confirm('Bu ödeme seçeneği yeni işlemlerde gizlenecek. Eski raporlar korunacak.')
    if (!confirmed) return
    setSaving(true)
    setError('')
    try {
      const result = await api(`/api/settings/payment-methods/${method.id}`, { method: 'DELETE', silent: true })
      setMethods(normalizeMethods(result))
      toast.success('Ödeme seçeneği silindi')
    } catch (err) {
      setError(err.message)
      toast.error(err.message || 'Ödeme seçeneği silinemedi')
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = methods.map((method, index) => ({
        id: method.id,
        name: String(method.name || '').trim(),
        type: method.type,
        enabled: method.enabled === true,
        isDefault: method.isDefault === true,
        isSystem: method.isSystem === true,
        isDeleted: method.isDeleted === true,
        sortOrder: index + 1,
      }))
      const result = await api('/api/settings/payment-methods', { method: 'PUT', data: { paymentMethods: payload }, silent: true })
      setMethods(normalizeMethods(result))
      setEditingId('')
      toast.success('Ödeme seçenekleri kaydedildi')
    } catch (err) {
      setError(err.message)
      toast.error(err.message || 'Ödeme seçenekleri kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div>Yükleniyor...</div>
  }

  return (
    <div>
      {showHeading ? <h3 style={{ marginTop: 0 }}>Ödeme Seçenekleri Ayarları</h3> : null}
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'grid', gap: 10, maxWidth: 860, width: '100%' }}>
        {(methods || []).map((method) => {
          const isEditing = editingId === method.id
          return (
          <div key={method.id} className="card" style={{ display: 'grid', gap: 12, padding: 14, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'minmax(0, 1.6fr) auto', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <label style={{ display: 'flex', alignItems: isMobilePortrait ? 'flex-start' : 'center', gap: 12, minWidth: 0 }}>
                <input type="checkbox" checked={!!method.enabled} onChange={() => toggleEnabled(method.id)} disabled={saving} />
                {!isEditing ? (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{method.name}</div>
                    <div style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                      {method.enabled ? 'Aktif odeme yontemi' : 'Pasif odeme yontemi'}
                    </div>
                  </div>
                ) : (
                  <input
                    className="input"
                    value={method.name || ''}
                    onChange={(event) => updateName(method.id, event.target.value)}
                    placeholder="Ödeme adı"
                    disabled={saving}
                    style={{ minWidth: 0 }}
                  />
                )}
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: isMobilePortrait ? 'stretch' : 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditingId(isEditing ? '' : method.id)}
                  disabled={saving}
                  style={{ flex: isMobilePortrait ? '1 1 140px' : undefined }}
                >
                  {isEditing ? 'Tamam' : 'Duzenle'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => removeMethod(method)}
                  disabled={saving}
                  style={{ borderColor: '#fecaca', color: '#b91c1c', flex: isMobilePortrait ? '1 1 140px' : undefined }}
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        )})}
      </div>

      <div className="card" style={{ marginTop: 12, maxWidth: 860, width: '100%', display: 'grid', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Yeni ödeme seçeneği</div>
            <div style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>Yemek Kartı, Ticket, Multinet, Havale, Online Ödeme gibi yeni yöntemler ekleyebilirsiniz.</div>
          </div>
          <button type="button" className="btn" onClick={() => setAdding((current) => !current)} disabled={saving} style={{ width: isMobilePortrait ? '100%' : undefined }}>
            {adding ? 'Vazgeç' : '+ Ödeme Seçeneği Ekle'}
          </button>
        </div>
        {adding && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            <input
              className="input"
              value={addingName}
              onChange={(event) => setAddingName(event.target.value)}
              placeholder="Ödeme adı"
              disabled={saving}
              style={{ flex: '1 1 280px', minWidth: isMobilePortrait ? 0 : 220 }}
            />
            <button type="button" className="btn" onClick={addMethod} disabled={saving} style={{ width: isMobilePortrait ? '100%' : undefined }}>
              {saving ? 'Kaydediliyor...' : 'Ekle'}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={save} disabled={saving} style={{ width: isMobilePortrait ? '100%' : undefined }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>
    </div>
  )
}





