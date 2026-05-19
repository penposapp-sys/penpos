import React, { useEffect, useMemo, useState } from 'react'
import { Link, UNSAFE_NavigationContext as NavigationContext, useBeforeUnload } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useBusinessSettings } from '../context/BusinessSettingsContext.jsx'
import BulkProductsExcelCard from '../components/BulkProductsExcelCard.jsx'
import { PERMISSIONS } from '../constants/permissions.js'
import { toast } from '../lib/toast.js'
import { useTheme } from '../theme/ThemeContext.jsx'
import { themeKeys, themes } from '../theme/themeConfig.js'
import { buildSafeBusinessSettings, defaultBusinessSettings, mergeBusinessSettings } from '../lib/businessSettings.js'

const settingsTheme = {
  pageBg: 'radial-gradient(circle at top left, color-mix(in srgb, var(--settings-accent-soft) 28%, transparent) 0, transparent 32%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--settings-border) 62%, transparent) 0, transparent 28%), var(--app-bg)',
  cardBorder: 'var(--app-border)',
  cardMuted: 'var(--app-text-muted)',
  green: 'var(--settings-accent)',
  green2: 'var(--settings-accent-text)',
  danger: '#dc2626',
  shadow: 'var(--settings-accent-shadow)',
}

const BUSINESS_TOGGLE_SECTIONS = {
  general: [
    ['disableCreditAccounts', 'Cari hesapları özelliğini kapat', 'Ödeme sonrası cari akışını arka planda kapatır.'],
    ['saveCancelledOrders', 'İptal edilen siparişleri kaydet', 'İptal edilen siparişleri raporlarda tutmaya devam eder.'],
    ['hideTodoList', 'Yapılacaklar listesini kapat', 'Açılışta görünen görev listesini gizler.'],
    ['staffCannotOrderForOthers', 'Çalışanlar diğer çalışanların hesabına sipariş ekleyemez', 'Personel sadece kendi hesabından işlem yapar.'],
    ['requireCancelReasonForProduct', 'Ürün iptallerinde açıklama zorunlu olsun', 'İptal akışında sebep girmeden işlem tamamlanmaz.'],
    ['askGuestCountWhenOpeningTable', 'Masa açılırken kişi sayısı sor', 'Masa ilk açıldığında servis kişi sayısı alınır.'],
    ['trackCashInDrawer', 'Kasadaki parayı takip et', 'Kasa açılış/kapanış farklarını izlemeye yardımcı olur.'],
  ],
  notifications: [
    ['repeatPackageServiceAlert', 'Paket servis geldiğinde sürekli çal', 'Yeni paket siparişi alınana kadar uyarıyı tekrarlar.'],
    ['voiceAlertsEnabled', 'Sesli uyarılar', 'Desteklenen ekranlarda sesli anonsları açar.'],
  ],
  appearance: [
    ['darkMode', 'Karanlık mod', 'Kullanıcı arayüzünü koyu temaya geçirir.'],
    ['colorfulProducts', 'Renkli ürünler', 'Ürün kartlarını daha canlı renklerle gösterir.'],
    ['animationsEnabled', 'Animasyonlar', 'Geçiş ve kart hareketlerini açık tutar.'],
  ],
  order: [
    ['confirmBeforeAddingToCart', 'Ürünleri sepete eklemeden onayla', 'Seçilen ürünü sepete atmadan önce kısa onay gösterir.'],
    ['returnToOpenTablesAfterOrder', 'Sipariş onayından sonra açık masalara dön', 'Sipariş tamamlandıktan sonra masa listesine geri döner.'],
    ['addToCartWithoutOptionQuestion', 'Ek seçenek sormadan sepete ekle', 'Opsiyon ekranını atlayıp hızlı ekleme yapar.'],
    ['askGuestCountInQuickOrder', 'Hızlı siparişte kişi sayısı sor', 'Walk-in siparişlerinde kişi sayısını sorar.'],
  ],
  automation: [
    ['autoClosePackageOrdersAfterPayment', 'Paket siparişlerini ödemeden sonra otomatik kapat', 'Ödemesi biten paketleri açık listeden düşürür.'],
    ['autoClosePaidTables', 'Masaları ödemeden sonra otomatik kapat', 'Ödemesi tamamlanan masaları kapatmaya hazır hale getirir.'],
  ],
  catalogView: [
    ['manualCategorySort', 'Kategori sıralamasını manuel belirle', 'Kategori düzeninde elle verilen sort değerini kullanır.'],
    ['sortProductsInsideCategory', 'Ürünleri kategori içinde sırala', 'Ürünleri kategori kendi iç sırasına göre listeler.'],
    ['moveOutOfStockToEnd', 'Stokta olmayan ürünleri en sona at', 'Satışı kapalı ürünleri listenin sonuna iter.'],
    ['hidePassiveProducts', 'Pasif ürünleri listede gösterme', 'Pasif ürünleri katalog görünümünden gizler.'],
    ['showCategoryHeaders', 'Ürünlerde kategori başlıklarını göster', 'Ürün listesinde kategori ayraçlarını görünür tutar.'],
    ['showLargePrice', 'Ürün fiyatını büyük göster', 'Kartlarda fiyat alanını daha baskın hale getirir.'],
    ['showProductImage', 'Ürün görseli göster', 'Liste ve kartlarda görsel alanını açar.'],
    ['showProductDescription', 'Ürün açıklamasını göster', 'Ürün açıklamasını kart altında görünür yapar.'],
  ],
}

const SOUND_OPTIONS = [
  ['MONEY', 'MONEY'],
  ['BEEPS', 'BEEPS'],
  ['none', 'Kapalı'],
]

const FONT_SIZE_OPTIONS = [
  ['small', 'Küçük'],
  ['medium', 'Orta'],
  ['large', 'Büyük'],
]

const CATEGORY_VIEW_OPTIONS = [
  ['card', 'Kart'],
  ['tabs', 'Sekme'],
  ['list', 'Liste'],
  ['grid', 'Grid'],
]

const PRODUCT_VIEW_OPTIONS = [
  ['grid', 'Grid'],
  ['list', 'Liste'],
]

const SORT_OPTIONS = [
  ['manual', 'Manuel'],
  ['alphabetical', 'Alfabetik'],
]

const PRODUCT_SORT_OPTIONS = [
  ['category', 'Kategoriye göre'],
  ['manual', 'Manuel'],
  ['alphabetical', 'Alfabetik'],
]

const cardStyle = {
  borderRadius: 30,
  border: `1px solid ${settingsTheme.cardBorder}`,
  background: 'var(--app-surface)',
  boxShadow: settingsTheme.shadow,
}

function iconBox(label) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 18,
        display: 'grid',
        placeItems: 'center',
        fontSize: 13,
        fontWeight: 900,
        color: 'var(--app-text)',
        background: 'var(--app-surface-2, var(--app-surface-soft))',
        border: `1px solid ${settingsTheme.cardBorder}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {label}
    </div>
  )
}

function SettingsPageSurface({ title, description, actions, children }) {
  const { theme } = useTheme()
  const settingsCssVars = {
    '--settings-border': theme.border,
    '--settings-accent': theme.accent,
    '--settings-accent-soft': theme.accentSoft,
    '--settings-accent-text': theme.accentText,
    '--settings-gradient': theme.gradient,
    '--settings-accent-shadow': theme.activeGlow,
  }
  return (
    <div
      style={{
        background: settingsTheme.pageBg,
        borderRadius: 32,
        padding: 20,
        border: `1px solid ${settingsTheme.cardBorder}`,
        boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)',
        ...settingsCssVars,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--app-text)', letterSpacing: '-0.03em' }}>{title}</div>
          {description && <div style={{ marginTop: 6, fontSize: 13, color: settingsTheme.cardMuted, maxWidth: 720 }}>{description}</div>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

function SettingsDesignStyles() {
  return (
    <style>{`
      .settings-card {
        border: 1px solid var(--settings-border);
        border-radius: 30px;
        background: var(--app-surface);
        padding: 22px;
        margin-bottom: 22px;
        box-shadow: 0 18px 50px rgba(15,23,42,0.18);
      }
      .settings-card-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .settings-card-title {
        display: flex;
        gap: 14px;
        align-items: center;
      }
      .settings-card-icon,
      .settings-page-icon,
      .settings-module-icon {
        width: 54px;
        height: 54px;
        border-radius: 20px;
        display: grid;
        place-items: center;
        font-size: 26px;
        background: var(--app-surface-2);
        border: 1px solid var(--settings-border);
      }
      .settings-card h2,
      .settings-page-header h1,
      .settings-module-card h3 {
        margin: 0;
        color: var(--app-text);
        font-weight: 950;
      }
      .settings-card p {
        margin: 4px 0 0;
        color: var(--app-text-muted);
        font-weight: 700;
        font-size: 13px;
      }
      .settings-page-header {
        border: 1px solid var(--settings-border);
        border-radius: 30px;
        padding: 20px;
        margin-bottom: 22px;
        background: linear-gradient(135deg, var(--app-surface), var(--app-surface-2));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .settings-page-title,
      .settings-page-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .settings-menü-btn {
        width: 50px;
        height: 50px;
        border-radius: 18px;
        border: 0;
        background: var(--app-button-bg);
        color: var(--app-text);
        font-size: 22px;
        font-weight: 900;
        cursor: pointer;
      }
      .settings-page-title span {
        color: var(--settings-accent-text);
        font-size: 12px;
        font-weight: 950;
        text-transform: uppercase;
      }
      .settings-back-btn,
      .settings-save-btn {
        border: 0;
        border-radius: 18px;
        padding: 13px 18px;
        font-weight: 950;
      }
      .settings-back-btn {
        background: var(--app-button-bg);
        color: var(--app-text);
        border: 1px solid var(--app-border);
      }
      .settings-save-btn {
        color: white;
        background: var(--settings-gradient);
      }
      .settings-module-card {
        text-align: left;
        border: 1px solid var(--settings-border);
        border-radius: 28px;
        padding: 22px;
        background: linear-gradient(135deg, var(--app-surface), var(--app-surface-2));
        box-shadow: 0 12px 34px rgba(15,23,42,0.18);
        transition: all .2s ease;
        cursor: pointer;
      }
      .settings-module-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 24px 60px rgba(15,23,42,0.13);
        border-color: var(--settings-accent);
      }
      .settings-module-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
      }
      .settings-module-badge {
        padding: 7px 11px;
        border-radius: 999px;
        background: var(--settings-accent-soft);
        color: var(--settings-accent-text);
        font-size: 12px;
        font-weight: 950;
      }
      .settings-module-card p {
        min-height: 42px;
        color: var(--app-text-muted);
        font-size: 14px;
        font-weight: 700;
      }
      .settings-module-link {
        margin-top: 18px;
        color: var(--settings-accent-text);
        font-size: 14px;
        font-weight: 950;
      }
      .catalog-settings-page {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .catalog-sort-list {
        display: grid;
        gap: 12px;
      }
      .catalog-sort-row {
        min-height: 72px;
        border-radius: 22px;
        background: var(--app-surface-2);
        border: 1px solid var(--settings-border);
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .catalog-sort-row span {
        display: block;
        color: var(--app-text-muted);
        font-size: 13px;
        font-weight: 700;
        margin-top: 4px;
      }
      .catalog-row-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .catalog-table {
        display: grid;
        gap: 10px;
      }
      .catalog-table-head,
      .catalog-table-row {
        display: grid;
        grid-template-columns: 2fr 1.3fr 1fr 1fr .7fr 1.8fr;
        gap: 12px;
        align-items: center;
      }
      .catalog-table-head {
        color: var(--app-text-muted);
        font-size: 12px;
        font-weight: 950;
        text-transform: uppercase;
        padding: 0 16px;
      }
      .catalog-table-row {
        min-height: 70px;
        background: var(--app-surface);
        border: 1px solid var(--settings-border);
        border-radius: 22px;
        padding: 14px 16px;
      }
      .catalog-table-row div {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .catalog-table button,
      .catalog-sort-row button,
      .settings-action-row button {
        border: 1px solid var(--settings-border);
        background: var(--app-surface-2);
        border-radius: 14px;
        padding: 10px 14px;
        font-weight: 900;
      }
      .settings-action-row {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }
      @media (max-width: 768px) {
        .settings-page-header {
          align-items: flex-start;
          flex-direction: column;
        }
        .catalog-sort-row {
          align-items: flex-start;
          flex-direction: column;
        }
        .catalog-table-head,
        .catalog-table-row {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  )
}

function SettingsCard({ title, description, icon, action, children }) {
  return (
    <section className="settings-card" style={{ marginBottom: 0 }}>
      <div className="settings-card-head">
        <div className="settings-card-title">
          <div className="settings-card-icon">{icon}</div>
          <div>
            <h2 style={{ fontSize: 21, letterSpacing: '-0.03em' }}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function SettingsPageHeader({ title, icon, onToggleMenu, onBack, children }) {
  return (
    <div className="settings-page-header">
      <div className="settings-page-title">
        <button type="button" className="settings-menü-btn" onClick={onToggleMenu}>☰</button>
        <div className="settings-page-icon">{icon}</div>
        <div>
          <span>Alt Ayar Sayfası</span>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="settings-page-actions">
        <button type="button" className="settings-back-btn" onClick={onBack}>← Ayarlara Dön</button>
        {children}
      </div>
    </div>
  )
}

function SettingsModuleCard({ item, onOpen }) {
  return (
    <button type="button" className="settings-module-card" onClick={() => onOpen(item.key)}>
      <div className="settings-module-top">
        <div className="settings-module-icon">{item.icon}</div>
        <span className="settings-module-badge">{item.group}</span>
      </div>

      <h3>{item.title}</h3>
      <p>{item.description}</p>

      <div className="settings-module-link">Ayar sayfasını aç →</div>
    </button>
  )
}

function SettingsField({ label, children, hint }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--app-text-muted)', fontWeight: 900 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: settingsTheme.cardMuted }}>{hint}</div>}
    </label>
  )
}

function inputStyle() {
  return {
    minHeight: 50,
    borderRadius: 18,
    border: `1px solid ${settingsTheme.cardBorder}`,
    background: 'var(--app-input)',
    padding: '0 16px',
    color: 'var(--app-text)',
    fontWeight: 700,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  }
}

function textAreaStyle() {
  return {
    ...inputStyle(),
    padding: 16,
    minHeight: 110,
    resize: 'vertical',
  }
}

function SettingsToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <label
      style={{
        minHeight: 72,
        borderRadius: 26,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        border: `1px solid ${checked ? 'var(--settings-accent)' : 'var(--app-border)'}`,
        background: checked
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--settings-accent) 20%, var(--app-surface-2)), var(--app-surface))'
          : 'linear-gradient(135deg, var(--app-surface), var(--app-surface-2))',
        boxShadow: checked ? 'var(--settings-accent-shadow)' : '0 10px 24px rgba(15, 23, 42, 0.05)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontWeight: 800, color: 'var(--app-text)' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: settingsTheme.cardMuted, lineHeight: 1.45 }}>{description}</div>}
      </div>
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <input type="checkbox" checked={!!checked} onChange={onChange} disabled={disabled} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
        <span
          style={{
            height: 34,
            width: 62,
            borderRadius: 999,
            background: checked ? 'var(--settings-gradient)' : 'var(--app-surface-3, var(--app-button-bg))',
            padding: 4,
            display: 'flex',
            justifyContent: checked ? 'flex-end' : 'flex-start',
            transition: 'all 180ms ease',
            boxShadow: 'inset 0 2px 6px rgba(15,23,42,0.15)',
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--app-surface)', boxShadow: '0 6px 14px rgba(15,23,42,0.18)' }} />
        </span>
      </span>
    </label>
  )
}

function ToggleSection({ items, values, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
      {items.map(([key, label, description]) => (
        <SettingsToggle
          key={key}
          label={label}
          description={description}
          checked={!!values?.[key]}
          onChange={(event) => onToggle(key, event.target.checked)}
        />
      ))}
    </div>
  )
}

function SaveButton({ children = 'Kaydet', disabled = false, type = 'button', onClick }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        borderRadius: 18,
        padding: '14px 22px',
        fontWeight: 900,
        color: '#ffffff',
        background: 'var(--settings-gradient)',
        boxShadow: 'var(--settings-accent-shadow)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  )
}

function SoftButton({ children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 16,
        border: `1px solid ${settingsTheme.cardBorder}`,
        background: 'var(--app-button-bg)',
        color: 'var(--app-text)',
        padding: '12px 16px',
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function DangerButton({ children, onClick, disabled = false, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        borderRadius: 16,
        padding: '12px 16px',
        fontWeight: 800,
        color: '#ffffff',
        background: 'linear-gradient(135deg,#dc2626,#f87171)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  )
}

function StatusNotice({ type, children }) {
  if (!children) return null
  const isError = type === 'error'
  return (
    <div
      style={{
        ...cardStyle,
        padding: '12px 16px',
        borderColor: isError ? '#fecaca' : '#bbf7d0',
        background: isError ? '#fef2f2' : '#f0fdf4',
        color: isError ? '#b91c1c' : '#166534',
        fontWeight: 800,
      }}
    >
      {children}
    </div>
  )
}

function ThemeSelector({ selectedThemeName, onSelectThemeName }) {
  const { setThemeKey } = useTheme()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {themeKeys.map((key) => {
        const theme = themes[key]
        const selected = selectedThemeName === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              setThemeKey(key)
              onSelectThemeName(key)
            }}
            style={{
              borderRadius: 24,
              padding: 16,
              textAlign: 'left',
              border: `1px solid ${selected ? 'var(--settings-accent)' : 'var(--app-border)'}`,
              background: selected ? 'var(--settings-gradient)' : 'var(--app-surface)',
              color: selected ? '#ffffff' : 'var(--app-text)',
              cursor: 'pointer',
              boxShadow: selected ? 'var(--settings-accent-shadow)' : '0 12px 24px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ height: 48, borderRadius: 16, background: theme.gradient }} />
            <div style={{ marginTop: 12, fontWeight: 900 }}>{theme.name}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: selected ? '#ffffff' : 'var(--app-text)' }}>
              Yan menü, üst bar ve aktif vurgu renkleri bu temaya göre güncellenir.
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SectionSelect({ label, value, onChange, options, hint }) {
  return (
    <SettingsField label={label} hint={hint}>
      <select style={inputStyle()} value={value} onChange={onChange}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </SettingsField>
  )
}

function sortByOrder(list, getName) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const sortDiff = (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0)
    if (sortDiff !== 0) return sortDiff
    return String(getName(a) || '').localeCompare(String(getName(b) || ''), 'tr')
  })
}

function productPayloadFromItem(item, patch = {}) {
  return {
    categoryId: patch.categoryId ?? item.categoryId,
    name: patch.name ?? item.name,
    price: patch.price ?? item.price,
    description: patch.description ?? item.description ?? '',
    imageUrl: patch.imageUrl ?? item.imageUrl ?? '',
    sortOrder: patch.sortOrder ?? item.sortOrder ?? 0,
    isActive: patch.isActive ?? item.isActive,
    isWeightBased: patch.isWeightBased ?? item.isWeightBased,
    printLabelEnabled: patch.printLabelEnabled ?? item.printLabelEnabled,
  }
}

function useNavigationBlocker(blocker, when = true) {
  const { navigator } = React.useContext(NavigationContext)

  useEffect(() => {
    if (!when || !navigator?.block) return undefined
    const unblock = navigator.block((tx) => {
      const retry = () => {
        unblock()
        tx.retry()
      }
      blocker({ ...tx, retry })
    })
    return unblock
  }, [blocker, navigator, when])
}

export function SettingsSystemContent() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [allowedBranchIds, setAllowedBranchIdsLocal] = useState([])
  const [settings, setSettings] = useState(() => mergeBusinessSettings())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const { refresh, setAllowedBranchIds } = useAuth()
  const { setThemeKey } = useTheme()
  const {
    refresh: refreshBusinessSettings,
    setSettingsLocally,
    tenant: businessTenant,
    settings: businessSettings,
    branches: businessBranches,
  } = useBusinessSettings()

  const apiOrigin = useMemo(() => {
    const fallback = '/api'
    try {
      const url = new URL(import.meta.env.VITE_API_URL || fallback)
      url.port = '4000'
      return url.origin
    } catch {
      return fallback
    }
  }, [])

  const logoPreviewSrc = useMemo(() => {
    const raw = String(logoUrl || '').trim()
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    return `${apiOrigin}${raw.startsWith('/') ? '' : '/'}${raw}`
  }, [logoUrl, apiOrigin])

  const snapshot = useMemo(() => JSON.stringify({
    name,
    description,
    logoUrl,
    allowedBranchIds: [...allowedBranchIds].sort(),
    settings,
  }), [name, description, logoUrl, allowedBranchIds, settings])
  const isDirty = initialSnapshot && snapshot !== initialSnapshot

  useBeforeUnload(
    React.useCallback((event) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }, [isDirty])
  )

  useNavigationBlocker(
    React.useCallback((tx) => {
      const shouldLeave = window.confirm('Kaydedilmemiş değişiklikler var. Çıkmak istiyor musunuz?')
      if (shouldLeave) tx.retry()
    }, []),
    isDirty
  )

  const applyLoadedState = React.useCallback((tenantPayload, settingsPayload, branchPayload) => {
    const mergedSettings = mergeBusinessSettings(settingsPayload || {})
    const nextName = tenantPayload?.name || mergedSettings?.business?.businessName || ''
    const nextLogoUrl = tenantPayload?.logoUrl || mergedSettings?.logo?.url || ''
    const nextAllowed = Array.isArray(mergedSettings?.authorizedBranches?.branchIds)
      ? mergedSettings.authorizedBranches.branchIds.map(String)
      : []

    setName(nextName)
    setDescription(tenantPayload?.description || '')
    setLogoUrl(nextLogoUrl)
    setAllowedBranchIdsLocal(nextAllowed)
    setSettings(mergedSettings)
    setBranches(Array.isArray(branchPayload) ? branchPayload : [])
    setThemeKey(mergedSettings.appearance.themeId || defaultBusinessSettings.appearance.themeId)
    setInitialSnapshot(JSON.stringify({
      name: nextName,
      description: tenantPayload?.description || '',
      logoUrl: nextLogoUrl,
      allowedBranchIds: [...nextAllowed].sort(),
      settings: mergedSettings,
    }))
  }, [setThemeKey])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [settingsRes, branchesRes] = await Promise.all([
        api('/api/settings/business', { silent: true, skipBranchHeader: true }),
        api('/api/settings/business/branches', { silent: true, skipBranchHeader: true }),
      ])

      if (settingsRes?.success === false) {
        setError(settingsRes.message || 'Bu işlem için yetkiniz yok')
        return
      }
      applyLoadedState(settingsRes?.tenant, settingsRes?.settings, branchesRes?.branches || [])
      setSettingsLocally(settingsRes?.settings || {})
    } catch (err) {
      setError(err.message || 'Ayarlar yüklenemedi')
      setBranches([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!businessTenant) return
    if (initialSnapshot) return
    applyLoadedState(businessTenant, businessSettings, businessBranches)
  }, [applyLoadedState, businessBranches, businessSettings, businessTenant, initialSnapshot])

  const toggleAllowedBranch = (branchId, checked) => {
    const next = new Set(Array.isArray(allowedBranchIds) ? allowedBranchIds : [])
    if (checked) next.add(String(branchId))
    else next.delete(String(branchId))
    setAllowedBranchIdsLocal(Array.from(next))
  }

  const setSectionValue = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev?.[section] || {}),
        [key]: value,
      },
    }))
  }

  const onSave = async (event) => {
    event.preventDefault()
    if (allowedBranchIds.length === 0) {
      toast.error('En az bir şube seçmelisiniz')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const safeSettings = buildSafeBusinessSettings(settings, {
        business: {
          ...settings.business,
          businessName: name,
        },
        general: settings.general,
        notifications: settings.notifications,
        appearance: settings.appearance,
        order: settings.order,
        automation: settings.automation,
        authorizedBranches: {
          branchIds: allowedBranchIds,
        },
      })

      const settingsRes = await api('/api/settings/business', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          description,
          settings: safeSettings,
        }),
        silent: true,
        skipBranchHeader: true,
      })

      if (settingsRes?.success === false) {
        setError(settingsRes.message || 'Ayarlar kaydedilemedi')
        return
      }

      const mergedSettings = mergeBusinessSettings(settingsRes?.settings || safeSettings)
      setSettings(mergedSettings)
      setSettingsLocally(mergedSettings)
      setThemeKey(mergedSettings.appearance.themeId || defaultBusinessSettings.appearance.themeId)

      try {
        const nextAllowed = Array.isArray(settingsRes?.settings?.authorizedBranches?.branchIds)
          ? settingsRes.settings.authorizedBranches.branchIds.map(String)
          : allowedBranchIds
        setAllowedBranchIds(nextAllowed)
        window.dispatchEvent(new CustomEvent('allowed_branches_changed', { detail: { allowedBranchIds: nextAllowed } }))
      } catch {}

      const nextLogoUrl = settingsRes?.settings?.logo?.url || settingsRes?.tenant?.logoUrl || logoUrl
      setLogoUrl(nextLogoUrl)
      setSuccess('İşletme ayarları kaydedildi')
      toast.success('İşletme ayarları kaydedildi')
      applyLoadedState(settingsRes?.tenant, settingsRes?.settings, branches)
      await refreshBusinessSettings()
      await refresh()
    } catch (err) {
      const message = err.message || 'Ayarlar kaydedilemedi'
      setError(message)
      toast.error('Ayarlar kaydedilemedi')
    } finally {
      setLoading(false)
    }
  }

  const uploadLogo = async () => {
    if (!logoFile) return
    setLogoLoading(true)
    setError('')
    setSuccess('')
    try {
      const body = new FormData()
      body.append('file', logoFile)
      const res = await api('/api/settings/business/logo', { method: 'POST', body, silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setError(res.message || 'Logo yüklenemedi')
        return
      }
      const nextLogoUrl = res?.logo?.url || res?.logoUrl || ''
      setLogoUrl(nextLogoUrl)
      setLogoFile(null)
      setSuccess('Logo güncellendi.')
      await refreshBusinessSettings()
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
      const res = await api('/api/settings/business/logo', { method: 'DELETE', silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setError(res.message || 'Logo kaldırılamadı')
        return
      }
      setLogoUrl('')
      setLogoFile(null)
      setSuccess('Logo kaldırıldı.')
      await refreshBusinessSettings()
    } catch (err) {
      setError(err.message || 'Logo kaldırılamadı')
    } finally {
      setLogoLoading(false)
    }
  }

  return (
    <>
      <SettingsDesignStyles />
      <SettingsPageSurface
        title="İşletme Ayarları"
        description="Mevcut tenant kayıt davranışını bozmadan genel işletme, bildirim, görünüm, sipariş ve otomasyon ayarlarını tek ekrandan yönetin."
        actions={<SaveButton type="submit" onClick={onSave} disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</SaveButton>}
      >
        <form onSubmit={onSave} style={{ display: 'grid', gap: 16 }}>
        <StatusNotice type="error">{error}</StatusNotice>
        <StatusNotice type="success">{success}</StatusNotice>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <SettingsCard
            title="İşletme Kimliği"
            description="Şirket bilgileri, servis metinleri ve vitrin alanları burada tutulur."
            icon="🏪"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              <SettingsField label="İşletme Adı">
                <input style={inputStyle()} value={name} onChange={(e) => setName(e.target.value)} />
              </SettingsField>
              <SettingsField label="Şirket Adı">
                <input style={inputStyle()} value={settings.business.companyName || ''} onChange={(e) => setSectionValue('business', 'companyName', e.target.value)} />
              </SettingsField>
              <SettingsField label="Yetkili Adı">
                <input style={inputStyle()} value={settings.business.authorizedName || ''} onChange={(e) => setSectionValue('business', 'authorizedName', e.target.value)} />
              </SettingsField>
              <SettingsField label="Kapanış Saati">
                <input style={inputStyle()} type="time" value={settings.business.closingTime || ''} onChange={(e) => setSectionValue('business', 'closingTime', e.target.value)} />
              </SettingsField>
              <SettingsField label="Servis Ücreti">
                <input style={inputStyle()} type="number" min="0" step="0.01" value={settings.business.serviceFee ?? 0} onChange={(e) => setSectionValue('business', 'serviceFee', Number(e.target.value) || 0)} />
              </SettingsField>
              <SettingsField label="Servis Ücreti Yazısı">
                <input style={inputStyle()} value={settings.business.serviceFeeText || ''} onChange={(e) => setSectionValue('business', 'serviceFeeText', e.target.value)} />
              </SettingsField>
              <SettingsField label="Açıklama">
                <textarea style={textAreaStyle()} rows="4" value={description} onChange={(e) => setDescription(e.target.value)} />
              </SettingsField>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Restoran Logosu"
            description="Logo yükleme akışı ve mevcut görsel aynı endpointlerle korunur."
            icon="🖼️"
            action={
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <SoftButton onClick={uploadLogo} disabled={!logoFile || logoLoading}>{logoLoading ? 'Yükleniyor...' : 'Logo Yükle'}</SoftButton>
                <DangerButton onClick={removeLogo} disabled={!logoUrl || logoLoading}>Kaldır</DangerButton>
              </div>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 88, height: 88, borderRadius: 24, border: `1px solid ${settingsTheme.cardBorder}`, background: 'var(--app-surface-2, var(--app-surface-soft))', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                {logoPreviewSrc ? (
                  <img src={logoPreviewSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: 12, color: settingsTheme.cardMuted, fontWeight: 800 }}>Logo yok</span>
                )}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <SettingsField label="Dosya Seç">
                  <input style={{ ...inputStyle(), paddingTop: 12, paddingBottom: 12 }} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </SettingsField>
                <div style={{ fontSize: 12, color: settingsTheme.cardMuted }}>PNG, JPG veya WebP. Maksimum 2 MB.</div>
              </div>
            </div>
          </SettingsCard>
        </div>

        <SettingsCard
          title="Genel Ayarlar"
          description="Cari, iptal, kasa ve masa açılış davranışlarını mevcut sistem üzerine ekler."
          icon="⚙️"
        >
          <ToggleSection items={BUSINESS_TOGGLE_SECTIONS.general} values={settings.general} onToggle={(key, value) => setSectionValue('general', key, value)} />
        </SettingsCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <SettingsCard
            title="Bildirim Ayarları"
            description="Ödeme, sipariş, paket ve QR uyarıları tenant bazında saklanır."
            icon="🔔"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
              <SectionSelect label="Dil" value={settings.notifications.language} onChange={(e) => setSectionValue('notifications', 'language', e.target.value)} options={[['tr', 'Türkçe'], ['en', 'English']]} />
              <SectionSelect label="Hesap ödeme sesi" value={settings.notifications.accountPaymentSound} onChange={(e) => setSectionValue('notifications', 'accountPaymentSound', e.target.value)} options={SOUND_OPTIONS} />
              <SectionSelect label="Sipariş geldiğinde sesli uyarı" value={settings.notifications.orderSound} onChange={(e) => setSectionValue('notifications', 'orderSound', e.target.value)} options={SOUND_OPTIONS} />
              <SectionSelect label="Paket servis geldiğinde sesli uyarı" value={settings.notifications.packageServiceSound} onChange={(e) => setSectionValue('notifications', 'packageServiceSound', e.target.value)} options={SOUND_OPTIONS} />
              <SectionSelect label="QR menü sipariş bildirim sesi" value={settings.notifications.qrMenuOrderSound} onChange={(e) => setSectionValue('notifications', 'qrMenuOrderSound', e.target.value)} options={SOUND_OPTIONS} />
            </div>
            <ToggleSection items={BUSINESS_TOGGLE_SECTIONS.notifications} values={settings.notifications} onToggle={(key, value) => setSectionValue('notifications', key, value)} />
          </SettingsCard>

          <SettingsCard
            title="Yetkili Şubeler"
            description="POS, hızlı sipariş ve paket ekranlarının çalışacağı şubeleri yönetin."
            icon="🏢"
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {(branches || []).length === 0 ? (
                <div style={{ color: settingsTheme.cardMuted, fontWeight: 700 }}>Şube bulunamadı.</div>
              ) : (
                (branches || []).map((branch) => (
                  <label
                    key={branch._id || branch.id}
                    style={{
                      borderRadius: 22,
                      padding: 14,
                      border: `1px solid ${allowedBranchIds.includes(String(branch._id || branch.id)) ? 'var(--settings-accent)' : 'var(--app-border)'}`,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      background: allowedBranchIds.includes(String(branch._id || branch.id))
                        ? 'linear-gradient(135deg, color-mix(in srgb, var(--settings-accent) 18%, var(--app-surface-2)), var(--app-surface))'
                        : 'var(--app-surface-2, var(--app-surface-soft))',
                    }}
                  >
                    <input type="checkbox" checked={allowedBranchIds.includes(String(branch._id || branch.id))} onChange={(e) => toggleAllowedBranch(branch._id || branch.id, e.target.checked)} />
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontWeight: 800, color: 'var(--app-text)' }}>{branch.name}</div>
                      {!!branch.description && <div style={{ fontSize: 12, color: settingsTheme.cardMuted }}>{branch.description}</div>}
                    </div>
                  </label>
                ))
              )}
            </div>
          </SettingsCard>
        </div>

        <SettingsCard
          title="Görünüm"
          description="Tema adı, yazı boyutu ve ürün kartı tercihleri kaydedilir."
          icon="🎨"
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <SectionSelect label="Yazı Boyutu" value={settings.appearance.fontSize} onChange={(e) => setSectionValue('appearance', 'fontSize', e.target.value)} options={FONT_SIZE_OPTIONS} />
            </div>
            <ToggleSection items={BUSINESS_TOGGLE_SECTIONS.appearance} values={settings.appearance} onToggle={(key, value) => setSectionValue('appearance', key, value)} />
            <ThemeSelector selectedThemeName={settings.appearance.themeId} onSelectThemeName={(value) => setSectionValue('appearance', 'themeId', value)} />
          </div>
        </SettingsCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <SettingsCard
            title="Sipariş Ayarları"
            description="Sepet ve masa akışlarını güvenli şekilde kişiselleştirir."
            icon="🧾"
          >
            <ToggleSection items={BUSINESS_TOGGLE_SECTIONS.order} values={settings.order} onToggle={(key, value) => setSectionValue('order', key, value)} />
          </SettingsCard>

          <SettingsCard
            title="Otomasyon"
            description="Ödemeden sonra kapanış davranışlarını tenant bazlı açık tutar."
            icon="🤖"
          >
            <ToggleSection items={BUSINESS_TOGGLE_SECTIONS.automation} values={settings.automation} onToggle={(key, value) => setSectionValue('automation', key, value)} />
          </SettingsCard>
        </div>
        </form>
      </SettingsPageSurface>
    </>
  )
}

export function SettingsMenuHub() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(() => mergeBusinessSettings())
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [sortSaving, setSortSaving] = useState('')
  const canBulk = user?.role === 'tenant_admin' || (Array.isArray(user?.permissions) && user.permissions.includes(PERMISSIONS.MANAGE_MENU))

  const sortedCategories = useMemo(() => sortByOrder(categories, (item) => item?.name), [categories])
  const sortedItems = useMemo(() => sortByOrder(menuItems, (item) => item?.name), [menuItems])
  const categoryNameById = useMemo(() => {
    const map = new Map()
    for (const item of sortedCategories) map.set(String(item.id), item.name)
    return map
  }, [sortedCategories])

  const selectedItem = useMemo(() => {
    const next = sortedItems.find((item) => String(item.id) === String(selectedItemId))
    return next || sortedItems[0] || null
  }, [sortedItems, selectedItemId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [profileRes, categoriesRes, itemsRes] = await Promise.all([
        api('/api/tenant/profile', { silent: true, skipBranchHeader: true }),
        api('/api/tenant/categories', { silent: true, skipBranchHeader: true }),
        api('/api/tenant/menu-items', { silent: true, skipBranchHeader: true }),
      ])

      if (profileRes?.success === false) {
        setError(profileRes.message || 'Ayarlar yüklenemedi')
        return
      }

      const mergedSettings = mergeBusinessSettings(profileRes?.tenant?.settings || {})
      setSettings(mergedSettings)
      setCategories(Array.isArray(categoriesRes?.categories) ? categoriesRes.categories : [])
      setMenuItems(Array.isArray(itemsRes?.items) ? itemsRes.items : [])
      const firstItemId = Array.isArray(itemsRes?.items) && itemsRes.items[0] ? String(itemsRes.items[0].id) : ''
      setSelectedItemId((prev) => prev || firstItemId)
    } catch (err) {
      setError(err.message || 'Katalog verileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const setCatalogValue = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      catalogView: {
        ...(prev?.catalogView || {}),
        [key]: value,
      },
    }))
  }

  const saveCatalogSettings = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const safeSettings = buildSafeBusinessSettings(settings, {
        catalogView: settings.catalogView,
      })
      const res = await api('/api/tenant/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: safeSettings }),
        silent: true,
        skipBranchHeader: true,
      })
      if (res?.success === false) {
        setError(res.message || 'Kaydedilemedi')
        return
      }
      setSettings(mergeBusinessSettings(res?.tenant?.settings || safeSettings))
      setSuccess('Ürün ve kategori ayarları kaydedildi.')
    } catch (err) {
      setError(err.message || 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const persistCategoryOrder = async (nextList) => {
    setSortSaving('category')
    setError('')
    try {
      const normalized = nextList.map((item, index) => ({ ...item, sortOrder: index }))
      setCategories(normalized)
      await Promise.all(
        normalized.map((item) =>
          api(`/api/tenant/categories/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name: item.name, sortOrder: item.sortOrder, isActive: item.isActive }),
            silent: true,
            skipBranchHeader: true,
          })
        )
      )
      setSuccess('Kategori sırası güncellendi.')
    } catch (err) {
      setError(err.message || 'Kategori sırası güncellenemedi')
      await load()
    } finally {
      setSortSaving('')
    }
  }

  const persistItemOrder = async (nextList) => {
    setSortSaving('item')
    setError('')
    try {
      const normalized = nextList.map((item, index) => ({ ...item, sortOrder: index }))
      setMenuItems(normalized)
      await Promise.all(
        normalized.map((item) =>
          api(`/api/tenant/menu-items/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify(productPayloadFromItem(item, { sortOrder: item.sortOrder })),
            silent: true,
            skipBranchHeader: true,
          })
        )
      )
      setSuccess('Ürün sırası güncellendi.')
    } catch (err) {
      setError(err.message || 'Ürün sırası güncellenemedi')
      await load()
    } finally {
      setSortSaving('')
    }
  }

  const moveInList = (list, id, direction) => {
    const current = [...list]
    const index = current.findIndex((item) => String(item.id) === String(id))
    if (index === -1) return current
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= current.length) return current
    const swap = current[targetIndex]
    current[targetIndex] = current[index]
    current[index] = swap
    return current
  }

  const categoryViewItems = [
    ['manualCategorySort', 'Kategori sıralamasını manuel belirle', 'Sort alanına göre elle verilen sıralamayı kullanır.'],
    ['sortProductsInsideCategory', 'Ürünleri kategori içinde sırala', 'Kategori içinde ürün order değerlerine göre akış kurar.'],
    ['moveOutOfStockToEnd', 'Stokta olmayan ürünleri en sona at', 'Satışı kapalı ürünleri alt sıraya iter.'],
    ['hidePassiveProducts', 'Pasif ürünleri listede gösterme', 'Pasif kayıtları menü yüzeyinden kaldırır.'],
    ['showCategoryHeaders', 'Kategori başlıklarını göster', 'Katalogda bölüm ayraçlarını görünür tutar.'],
    ['showLargePrice', 'Ürün fiyatını büyük göster', 'Kartlarda fiyat alanını büyütür.'],
    ['showProductImage', 'Ürün görseli göster', 'Ürün kartına görsel alanı ekler.'],
    ['showProductDescription', 'Ürün açıklamasını göster', 'Kart altında açıklama metnini açar.'],
  ]

  return (
    <>
      <SettingsDesignStyles />
      <SettingsPageSurface
        title="Ürün & Kategori"
        description="Katalog görünümü, manuel sıralama, kategori listesi ve ürün tablosunu mevcut endpoint yapısını bozmadan aynı sayfada yönetin."
        actions={<SaveButton onClick={saveCatalogSettings} disabled={saving || loading}>{saving ? 'Kaydediliyor...' : 'Katalog Ayarlarını Kaydet'}</SaveButton>}
      >
        <div className="catalog-settings-page">
        <StatusNotice type="error">{error}</StatusNotice>
        <StatusNotice type="success">{success}</StatusNotice>

        <SettingsCard
          title="Liste Görünüm & Sıralama Ayarları"
          description="Kategori ve ürün görünüm mantığı bu sayfada toplu olarak yönetilir."
          icon="📊"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 16 }}>
            <SectionSelect label="Kategori liste görünümü" value={settings.catalogView.categoryViewMode} onChange={(e) => setCatalogValue('categoryViewMode', e.target.value)} options={CATEGORY_VIEW_OPTIONS} />
            <SectionSelect label="Ürün liste görünümü" value={settings.catalogView.productViewMode} onChange={(e) => setCatalogValue('productViewMode', e.target.value)} options={PRODUCT_VIEW_OPTIONS} />
            <SectionSelect label="Kategori sıralama modu" value={settings.catalogView.categorySortMode} onChange={(e) => setCatalogValue('categorySortMode', e.target.value)} options={SORT_OPTIONS} />
            <SectionSelect label="Ürün sıralama modu" value={settings.catalogView.productSortMode} onChange={(e) => setCatalogValue('productSortMode', e.target.value)} options={PRODUCT_SORT_OPTIONS} />
          </div>
          <ToggleSection items={categoryViewItems} values={settings.catalogView} onToggle={setCatalogValue} />
        </SettingsCard>

        <SettingsCard
          title="Kategori Sıralama Yönetimi"
          description="Kategoriler aynı sayfada toplu görünür ve manuel sıralama buradan yapılır."
          icon="🏷️"
          action={<Link className="btn" to="/kermes/settings/catalog/categories">Kategorileri Yönet</Link>}
        >
          <div className="catalog-sort-list">
            {sortedCategories.map((category, index) => (
              <div className="catalog-sort-row" key={category.id}>
                <div>
                  <strong>{index + 1}. {category.name}</strong>
                  <span>Sort: {category.sortOrder ?? index} • {category.isActive ? 'Aktif' : 'Pasif'}</span>
                </div>
                <div className="catalog-row-actions">
                  <SoftButton onClick={() => persistCategoryOrder(moveInList(sortedCategories, category.id, 'up'))} disabled={index === 0 || sortSaving === 'category'}>Yukarı</SoftButton>
                  <SoftButton onClick={() => persistCategoryOrder(moveInList(sortedCategories, category.id, 'down'))} disabled={index === sortedCategories.length - 1 || sortSaving === 'category'}>Aşağı</SoftButton>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard
          title="Ürünler Tablosu"
          description="Ürünler aynı sayfada toplu görünür, sıralama ve yönetim kısayolları korunur."
          icon="🍽️"
          action={<Link className="btn" to="/kermes/settings/catalog/items">Ürünleri Yönet</Link>}
        >
          <div className="catalog-table">
            <div className="catalog-table-head">
              <span>Ürün</span>
              <span>Kategori</span>
              <span>Fiyat</span>
              <span>Durum</span>
              <span>Sıra</span>
              <span>Aksiyon</span>
            </div>
            {sortedItems.map((item, index) => (
              <div className="catalog-table-row" key={item.id} onMouseEnter={() => setSelectedItemId(String(item.id))}>
                <strong>{item.name}</strong>
                <span>{categoryNameById.get(String(item.categoryId)) || '-'}</span>
                <span>{Number(item.price || 0).toFixed(2)} TL</span>
                <span>{item.isActive ? 'Aktif' : 'Pasif'}</span>
                <span>{item.sortOrder ?? 0}</span>
                <div>
                  <SoftButton onClick={() => persistItemOrder(moveInList(sortedItems, item.id, 'up'))} disabled={index === 0 || sortSaving === 'item'}>Yukarı</SoftButton>
                  <SoftButton onClick={() => persistItemOrder(moveInList(sortedItems, item.id, 'down'))} disabled={index === sortedItems.length - 1 || sortSaving === 'item'}>Aşağı</SoftButton>
                  <Link className="btn" to="/kermes/settings/catalog/items">Düzenle</Link>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>

        {canBulk && (
          <SettingsCard
            title="Toplu Ürün İşlemleri"
            description="Excel/CSV işlemleri mevcut sistemdeki akışla devam eder."
            icon="📥"
          >
            <BulkProductsExcelCard />
          </SettingsCard>
        )}
        </div>
      </SettingsPageSurface>
    </>
  )
}



