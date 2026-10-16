import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { clearApiCache } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import QRCode from 'qrcode'
import { buildSafeBusinessSettings, mergeBusinessSettings } from '../lib/businessSettings.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { buildPublicAppUrl } from '../lib/publicAppUrl.js'
import { resolveProductImageUrl } from '../lib/productImage.js'

const pageTheme = {
  pageBg: 'radial-gradient(circle at top left, color-mix(in srgb, var(--theme-accent) 18%, transparent) 0, transparent 32%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--theme-accent-hover) 14%, transparent) 0, transparent 28%), var(--app-bg)',
  cardBorder: 'var(--app-border)',
  shadow: '0 18px 50px rgba(15, 23, 42, 0.18)',
}

const normalizePublicSlug = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase('tr-TR')
  .replace(/ç/g, 'c')
  .replace(/ğ/g, 'g')
  .replace(/ı/g, 'i')
  .replace(/ö/g, 'o')
  .replace(/ş/g, 's')
  .replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-+/g, '-')

const qrSwitches = [
  ['enabled', 'QR Menü aç/kapat', 'Public menü yayınının aktif olup olmayacağını belirler.'],
  ['showLogo', 'Logo gösterimi', 'Kapakta ve üst alanda işletme logosunu gösterir.'],
  ['showPrices', 'Fiyatları göster', 'Ürün kartlarında fiyat bilgisini açar.'],
  ['showDescriptions', 'Ürün açıklaması', 'Açıklama metinlerini public menüde gösterir.'],
  ['waiterCall', 'Garson çağır', 'Desteklenen kurulumlarda garson çağır aksiyonunu açar.'],
  ['multiLanguage', 'Çoklu dil', 'Menü yüzeyinde çoklu dil deneyimini açar.'],
  ['tableQrEnabled', 'Masa QR oluştur', 'Masa bazlı QR akışına geçişi açar.'],
]

function cardStyle() {
  return {
    borderRadius: 24,
    border: `1px solid ${pageTheme.cardBorder}`,
    background: 'var(--app-surface)',
    boxShadow: pageTheme.shadow,
    padding: 16,
  }
}

function inputStyle() {
  return {
    minHeight: 50,
    borderRadius: 18,
    border: `1px solid ${pageTheme.cardBorder}`,
    background: 'var(--app-input)',
    padding: '0 16px',
    color: 'var(--app-text)',
    fontWeight: 700,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  }
}

function ToggleItem({ label, description, checked, onChange, disabled, compact = false }) {
  return (
    <label
      style={{
        minHeight: 76,
        borderRadius: 26,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: compact ? 'column' : 'row',
        justifyContent: 'space-between',
        gap: 14,
        alignItems: compact ? 'flex-start' : 'center',
        border: `1px solid ${checked ? 'var(--theme-accent)' : 'var(--app-border)'}`,
        background: checked
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--app-surface-2, var(--app-surface-soft))), var(--app-surface))'
          : 'linear-gradient(135deg, var(--app-surface), var(--app-surface-2, var(--app-surface-soft)))',
        opacity: 1,
        boxShadow: checked ? 'var(--theme-active-glow)' : 'none',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontWeight: 800, color: 'var(--app-text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--app-text)' }}>{description}</div>
      </div>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ position: 'absolute', opacity: 0 }} />
        <span
          style={{
            height: 34,
            width: 62,
            borderRadius: 999,
            background: checked ? 'var(--theme-gradient)' : 'var(--app-surface-3, var(--app-button-bg))',
            padding: 4,
            display: 'flex',
            justifyContent: checked ? 'flex-end' : 'flex-start',
            boxShadow: 'inset 0 2px 6px rgba(15,23,42,0.15)',
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--app-surface)', boxShadow: '0 6px 14px rgba(15,23,42,0.18)' }} />
        </span>
      </span>
    </label>
  )
}

function SaveButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        borderRadius: 18,
        padding: '14px 20px',
        color: '#ffffff',
        fontWeight: 900,
        background: 'var(--theme-gradient)',
        boxShadow: 'var(--theme-active-glow)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default function QrMenuSettingsPage() {
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const isCompact = isMobilePortrait || isTablet
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [websiteSlug, setWebsiteSlug] = useState('')
  const [settings, setSettings] = useState(() => mergeBusinessSettings())
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrTables, setQrTables] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedTableId, setSelectedTableId] = useState('')
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [featuredUploading, setFeaturedUploading] = useState(false)
  const [previewRevision, setPreviewRevision] = useState(0)

  const selectedTable = useMemo(
    () => {
      const table = qrTables.find((item) => String(item?.id || '') === String(selectedTableId || '')) || null
      if (!table) return null
      const branch = branches.find((item) => String(item?.id || item?._id || '') === String(table.branchId || ''))
      return { ...table, branchName: branch?.name || table.branchName || '' }
    },
    [qrTables, branches, selectedTableId]
  )
  const getTableLabel = (table) => {
    const branchName = branches.find((branch) => String(branch.id || branch._id) === String(table.branchId || ''))?.name
    return branchName ? `${table.name} · ${branchName}` : table.name
  }

  const liveLink = useMemo(() => {
    const businessName = String(settings?.business?.businessName || tenant?.name || '').trim()
    const slug = String(tenant?.publicSlug || normalizePublicSlug(businessName) || websiteSlug || tenant?.slug || '').trim()
    if (!slug) return ''
    const next = new URL(buildPublicAppUrl(`/menu/${slug}`))
    if (settings.qrMenu?.tableQrEnabled && selectedTable?.id) {
      next.searchParams.set('tableId', String(selectedTable.id))
      next.searchParams.set('table', String(selectedTable.name || ''))
    }
    return next.toString()
  }, [websiteSlug, tenant?.publicSlug, tenant?.slug, tenant?.name, settings?.business?.businessName, settings.qrMenu?.tableQrEnabled, selectedTable])

  const previewLink = useMemo(() => {
    const businessName = String(settings?.business?.businessName || tenant?.name || '').trim()
    const slug = String(tenant?.publicSlug || normalizePublicSlug(businessName) || websiteSlug || tenant?.slug || '').trim()
    if (!slug) return ''
    const next = new URL(buildPublicAppUrl(`/menu/${slug}`, null, { originMode: 'current' }))
    if (settings.qrMenu?.tableQrEnabled && selectedTable?.id) {
      next.searchParams.set('tableId', String(selectedTable.id))
      next.searchParams.set('table', String(selectedTable.name || ''))
    }
    return next.toString()
  }, [websiteSlug, tenant?.publicSlug, tenant?.slug, tenant?.name, settings?.business?.businessName, settings.qrMenu?.tableQrEnabled, selectedTable])

  const hasSeparateLocalPreview = import.meta.env.DEV && !!previewLink && !!liveLink && previewLink !== liveLink

  useEffect(() => {
    if (!liveLink) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(liveLink, { width: 320, margin: 2 }, (err, url) => {
      if (!err) setQrDataUrl(url)
    })
  }, [liveLink])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [profileRes, businessRes, websiteRes, tablesRes, productsRes, categoriesRes] = await Promise.all([
        api('/api/tenant/profile', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/settings/business', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/tenant/website', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/settings/business/qr-tables', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/tenant/menu-items?active=true', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/tenant/categories?active=true', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
      ])
      if (profileRes?.success === false) {
        setTenant(null)
        setSettings(mergeBusinessSettings())
        setError(profileRes?.message || 'Bu işlem için yetkiniz yok')
        return
      }
      if (businessRes?.success === false) {
        setTenant(null)
        setSettings(mergeBusinessSettings())
        setError(businessRes?.message || 'QR ayarları yüklenemedi')
        return
      }
      for (const response of [tablesRes, productsRes, categoriesRes]) {
        if (response?.success === false) {
          throw new Error(response.message || 'QR menü içerikleri yüklenemedi')
        }
      }
      const nextTenant = {
        ...(profileRes?.tenant || {}),
        publicSlug: businessRes?.tenant?.publicSlug || profileRes?.tenant?.slug || '',
      }
      setTenant(nextTenant)
      setWebsiteSlug(String(websiteRes?.settings?.slug || '').trim())
      setSettings(mergeBusinessSettings(businessRes?.settings || nextTenant?.settings || {}))
      const nextTables = Array.isArray(tablesRes?.tables) ? tablesRes.tables : []
      const nextProducts = Array.isArray(productsRes?.items) ? productsRes.items : []
      const nextCategories = Array.isArray(categoriesRes?.categories)
        ? categoriesRes.categories.filter((category) => category?.qrMenuVisible !== false)
        : []
      setQrTables(nextTables)
      setBranches(Array.isArray(businessRes?.branches) ? businessRes.branches : [])
      setProducts(nextProducts)
      setCategories(nextCategories)
      setSelectedTableId((prev) => {
        if (prev && nextTables.some((table) => String(table?.id || '') === String(prev))) return prev
        return ''
      })
    } catch (err) {
      setTenant(null)
      setSettings(mergeBusinessSettings())
      setQrTables([])
      setProducts([])
      setCategories([])
      setError(err?.message || 'QR ayarları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const setQrValue = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      qrMenu: {
        ...(prev?.qrMenu || {}),
        [key]: value,
      },
      qrMenuEnabled: key === 'enabled' ? value : (prev?.qrMenu?.enabled ?? prev?.qrMenuEnabled),
    }))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const safeSettings = buildSafeBusinessSettings(settings, {
        qrMenu: settings.qrMenu,
      })
      const res = await api('/api/settings/business', {
        method: 'PUT',
        body: JSON.stringify({
          name: tenant?.name || '',
          description: tenant?.description || '',
          settings: safeSettings,
        }),
        silent: true,
        skipBranchHeader: true,
      })
      if (res?.success === false) {
        setError(res?.message || 'QR ayarları kaydedilemedi')
        return
      }
      clearApiCache()
      setSettings(mergeBusinessSettings(res?.settings || safeSettings))
      setPreviewRevision((revision) => revision + 1)
      toast.success('QR ayarları kaydedildi')
    } catch (err) {
      setError(err?.message || 'QR ayarları kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const featuredProduct = useMemo(
    () => products.find((item) => String(item?.id || '') === String(settings.qrMenu?.featuredProductId || '')) || null,
    [products, settings.qrMenu?.featuredProductId]
  )

  const orderedCategories = useMemo(() => {
    const configuredOrder = Array.isArray(settings.qrMenu?.categoryOrder)
      ? settings.qrMenu.categoryOrder.map(String)
      : []
    const positions = new Map(configuredOrder.map((id, index) => [id, index]))
    return [...categories].sort((left, right) => {
      const leftId = String(left?.id || left?._id || '')
      const rightId = String(right?.id || right?._id || '')
      const leftPosition = positions.get(leftId)
      const rightPosition = positions.get(rightId)
      if (leftPosition !== undefined || rightPosition !== undefined) {
        if (leftPosition === undefined) return 1
        if (rightPosition === undefined) return -1
        if (leftPosition !== rightPosition) return leftPosition - rightPosition
      }
      return Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0)
    })
  }, [categories, settings.qrMenu?.categoryOrder])

  const moveCategory = (index, offset) => {
    const next = [...orderedCategories]
    const destination = index + offset
    if (destination < 0 || destination >= next.length) return
    ;[next[index], next[destination]] = [next[destination], next[index]]
    setQrValue('categoryOrder', next.map((category) => String(category.id || category._id)))
  }

  const toggleCategoryVisibility = (categoryId) => {
    const hidden = new Set((settings.qrMenu?.hiddenCategoryIds || []).map(String))
    if (hidden.has(categoryId)) hidden.delete(categoryId)
    else hidden.add(categoryId)
    setQrValue('hiddenCategoryIds', [...hidden])
  }

  const uploadSettingsImage = async (event, type) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!String(file.type || '').startsWith('image/')) {
      setError('Lütfen geçerli bir görsel dosyası seçin.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Görsel boyutu en fazla 5 MB olabilir.')
      return
    }

    const setUploading = type === 'logo' ? setLogoUploading : setFeaturedUploading
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await api(
        type === 'logo' ? '/api/settings/business/logo' : '/api/settings/business/qr-featured-image',
        { method: 'POST', body, silent: true, skipBranchHeader: true }
      )
      if (response?.success === false) throw new Error(response?.message || 'Görsel yüklenemedi')
      clearApiCache()
      if (type === 'logo') {
        const logoUrl = String(response?.logoUrl || response?.logo?.url || '').trim()
        setTenant((current) => ({ ...current, logoUrl }))
        setSettings((current) => ({
          ...current,
          logo: { ...current.logo, ...(response?.logo || {}), url: logoUrl },
          qrMenu: { ...current.qrMenu, showLogo: true }
        }))
      } else {
        setQrValue('featuredImageUrl', String(response?.imageUrl || '').trim())
      }
      setPreviewRevision((revision) => revision + 1)
      toast.success(type === 'logo' ? 'İşletme logosu güncellendi' : 'Öneri görseli güncellendi')
    } catch (uploadError) {
      setError(uploadError?.message || 'Görsel yüklenemedi')
    } finally {
      setUploading(false)
    }
  }

  const copyLink = async () => {
    if (!liveLink) return
    try {
      await navigator.clipboard.writeText(liveLink)
      toast.success('Public link kopyalandı')
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = liveLink
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast.success('Public link kopyalandı')
      } catch {
        toast.error('Kopyalama başarısız')
      }
    }
  }

  const copyPreviewLink = async () => {
    if (!previewLink) return
    try {
      await navigator.clipboard.writeText(previewLink)
      toast.success('Lokal önizleme linki kopyalandı')
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = previewLink
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast.success('Lokal önizleme linki kopyalandı')
      } catch {
        toast.error('Kopyalama başarısız')
      }
    }
  }

  const downloadQr = () => {
    if (!qrDataUrl) return
    const anchor = document.createElement('a')
    anchor.href = qrDataUrl
    const safeTableName = String(selectedTable?.name || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .toLocaleLowerCase('tr-TR')
    anchor.download = `qr-menu-${tenant?.slug || 'tenant'}${safeTableName ? `-${safeTableName}` : ''}.png`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  return (
    <div style={{ background: pageTheme.pageBg, borderRadius: isCompact ? 18 : 32, padding: isCompact ? 10 : 20, border: `1px solid ${pageTheme.cardBorder}`, boxShadow: isCompact ? '0 14px 28px rgba(15, 23, 42, 0.12)' : '0 24px 70px rgba(15, 23, 42, 0.18)', display: 'grid', gap: isCompact ? 12 : 16, color: 'var(--app-text)', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1fr) auto', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--app-text)' }}>QR Menü</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--app-text)', maxWidth: 700 }}>
            Public link, QR görseli ve yayın tercihleri mevcut tenant ayarları üstüne geriye dönük uyumlu olarak kaydedilir.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, max-content)', gap: 10, justifyContent: isCompact ? 'stretch' : 'end' }}>
          <button className="btn" onClick={load} disabled={loading || saving} style={{ width: isCompact ? '100%' : undefined }}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>
          <SaveButton onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'QR Ayarlarını Kaydet'}</SaveButton>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle(), borderColor: '#ef4444', background: 'color-mix(in srgb, #ef4444 14%, var(--app-surface))', color: '#fca5a5', fontWeight: 800, padding: '12px 16px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start' }}>
        <section style={{ ...cardStyle(), minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>QR Yayın Ayarları</div>
          <div style={{ fontSize: 12, color: 'var(--app-text)', marginBottom: 16 }}>Logo, kapak, açıklama, masa QR ve garson çağır blokları bu kartta toplanır.</div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {qrSwitches.map(([key, label, description]) => (
              <ToggleItem
                key={key}
                label={label}
                description={description}
                checked={!!settings.qrMenu?.[key]}
                onChange={(e) => setQrValue(key, e.target.checked)}
                disabled={saving}
                compact={isCompact}
              />
            ))}
          </div>
        </section>

        <section style={{ ...cardStyle(), minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>Tasarım ve Görünüm</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>Liman QR şablonu ortak kalır; bu alanlardaki içerik ve görünüm tercihleri yalnızca işletmenize kaydedilir.</div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Başlık üst yazısı
              <input value={settings.qrMenu?.brandLabel ?? tenant?.name ?? ''} onChange={(event) => setQrValue('brandLabel', event.target.value)} disabled={saving} maxLength={100} style={inputStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Menü başlığı
              <input value={settings.qrMenu?.title || ''} onChange={(event) => setQrValue('title', event.target.value)} disabled={saving} maxLength={80} style={inputStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Alt başlık
              <input value={settings.qrMenu?.subtitle || ''} onChange={(event) => setQrValue('subtitle', event.target.value)} disabled={saving} maxLength={80} style={inputStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800, gridColumn: isCompact ? undefined : '1 / -1' }}>
              Menü açıklaması
              <textarea value={settings.qrMenu?.description || ''} onChange={(event) => setQrValue('description', event.target.value)} disabled={saving} maxLength={500} rows={3} style={{ ...inputStyle(), padding: 14, resize: 'vertical' }} />
            </label>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Alt bilgi başlığı
              <input value={settings.qrMenu?.footerGreeting ?? 'Afiyet olsun'} onChange={(event) => setQrValue('footerGreeting', event.target.value)} disabled={saving} maxLength={100} style={inputStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Alt bilgi metni
              <input
                value={settings.qrMenu?.footerText ?? `${tenant?.name || ''} · ${String(settings.qrMenu?.title || '').trim() || tenant?.name || 'Menü'}`}
                onChange={(event) => setQrValue('footerText', event.target.value)}
                disabled={saving}
                maxLength={200}
                style={inputStyle()}
              />
            </label>
            <div style={{ display: 'grid', alignContent: 'start', gap: 10 }}>
              <div style={{ fontWeight: 800 }}>İşletme logosu</div>
              {tenant?.logoUrl ? <img src={tenant.logoUrl} alt="İşletme logosu" style={{ width: 120, height: 72, objectFit: 'contain', borderRadius: 12, background: 'var(--app-surface-2, var(--app-surface-soft))' }} /> : <div style={{ fontSize: 13 }}>Henüz logo yüklenmedi.</div>}
              <label className="btn" style={{ justifySelf: 'start', cursor: logoUploading ? 'wait' : 'pointer' }}>
                {logoUploading ? 'Yükleniyor...' : 'Logo yükle / değiştir'}
                <input type="file" accept="image/*" onChange={(event) => uploadSettingsImage(event, 'logo')} disabled={logoUploading || saving} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12, alignContent: 'start' }}>
              <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
                Renk paleti
                <select value={settings.qrMenu?.palette || 'liman'} onChange={(event) => setQrValue('palette', event.target.value)} disabled={saving} style={inputStyle()}>
                  <option value="liman">Liman — Deniz</option>
                  <option value="olive">Zeytin</option>
                  <option value="midnight">Gece</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
                Yazı tipi
                <select value={settings.qrMenu?.fontFamily || 'instrument'} onChange={(event) => setQrValue('fontFamily', event.target.value)} disabled={saving} style={inputStyle()}>
                  <option value="instrument">Instrument Sans / Serif</option>
                  <option value="system">Sistem yazı tipi</option>
                  <option value="serif">Serif</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle(), minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>Öneri kartı ve menü içeriği</div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <ToggleItem
              label="Öneri kartını göster"
              description="Menü başlığının altında seçtiğiniz gerçek ürün gösterilir."
              checked={settings.qrMenu?.featuredEnabled !== false}
              onChange={(event) => setQrValue('featuredEnabled', event.target.checked)}
              disabled={saving}
              compact={isCompact}
            />
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Öneri kartı başlığı
              <input value={settings.qrMenu?.featuredTitle || ''} onChange={(event) => setQrValue('featuredTitle', event.target.value)} disabled={saving} maxLength={80} style={inputStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Önerilen ürün
              <select value={String(settings.qrMenu?.featuredProductId || '')} onChange={(event) => setQrValue('featuredProductId', String(event.target.value || ''))} disabled={saving} style={inputStyle()}>
                <option value="">İlk aktif ürünü kullan</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{featuredProduct ? `Seçili ürün: ${featuredProduct.name}` : 'Öneri kartı açıkken ilk aktif ürün kullanılır.'}</span>
            </label>
            <label style={{ display: 'grid', gap: 7, fontWeight: 800 }}>
              Öneri metni
              <textarea value={settings.qrMenu?.featuredDescription || ''} onChange={(event) => setQrValue('featuredDescription', event.target.value)} disabled={saving} maxLength={300} rows={3} style={{ ...inputStyle(), padding: 14, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <div style={{ fontWeight: 800 }}>Öneri kartı görseli</div>
              {settings.qrMenu?.featuredImageUrl ? <img src={resolveProductImageUrl({ imageUrl: settings.qrMenu.featuredImageUrl })} alt="Öneri kartı önizlemesi" style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 12 }} /> : <div style={{ fontSize: 13 }}>Seçili ürünün görseli kullanılır.</div>}
              <label className="btn" style={{ justifySelf: 'start', cursor: featuredUploading ? 'wait' : 'pointer' }}>
                {featuredUploading ? 'Yükleniyor...' : 'Görsel yükle / değiştir'}
                <input type="file" accept="image/*" onChange={(event) => uploadSettingsImage(event, 'featured')} disabled={featuredUploading || saving} style={{ display: 'none' }} />
              </label>
              {settings.qrMenu?.featuredImageUrl ? <button className="btn" type="button" onClick={() => setQrValue('featuredImageUrl', '')} disabled={saving}>Özel görseli kaldır</button> : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {[
                ['showProductImages', 'Ürün görsellerini göster'],
                ['showDescriptions', 'Ürün açıklamalarını göster'],
                ['showPrices', 'Ürün fiyatlarını göster'],
                ['showCategoryCounts', 'Kategori ürün sayılarını göster'],
              ].map(([key, label]) => (
                <ToggleItem key={key} label={label} description="QR menüde görüntülenir." checked={settings.qrMenu?.[key] !== false} onChange={(event) => setQrValue(key, event.target.checked)} disabled={saving} compact />
              ))}
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle(), minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>Kategori sırası ve görünürlüğü</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {orderedCategories.map((category, index) => {
              const categoryId = String(category.id || category._id)
              const visible = !(settings.qrMenu?.hiddenCategoryIds || []).map(String).includes(categoryId)
              return (
                <div key={categoryId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', alignItems: 'center', gap: 8, padding: 10, border: `1px solid ${pageTheme.cardBorder}`, borderRadius: 14 }}>
                  <span style={{ fontWeight: 800 }}>{category.name}</span>
                  <button className="btn" type="button" aria-label={`${category.name} kategorisini yukarı taşı`} disabled={saving || index === 0} onClick={() => moveCategory(index, -1)}>↑</button>
                  <button className="btn" type="button" aria-label={`${category.name} kategorisini aşağı taşı`} disabled={saving || index === orderedCategories.length - 1} onClick={() => moveCategory(index, 1)}>↓</button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={visible} onChange={() => toggleCategoryVisibility(categoryId)} disabled={saving} />
                    Göster
                  </label>
                </div>
              )
            })}
            {!orderedCategories.length ? <div>Henüz kategori bulunmuyor.</div> : null}
          </div>
        </section>

        </div>

      <section style={{ ...cardStyle(), display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>QR Önizleme</div>
          <div style={{ fontSize: 13, color: 'var(--app-text)', marginBottom: 12 }}>
            Kaydetmeden önce canlı linki ve varsa lokal önizleme linkini ayrı ayrı kontrol edebilirsiniz.
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Canlı QR Linki</div>
              <div style={{ fontSize: 12, color: 'var(--app-text)', wordBreak: 'break-all' }}>{liveLink || '-'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={copyLink} disabled={!liveLink} style={{ justifySelf: 'start' }}>Canlı Linki Kopyala</button>
                <a className="btn" href={liveLink || '#'} target="_blank" rel="noreferrer" onClick={(event) => { if (!liveLink) event.preventDefault() }}>Canlıyı Aç</a>
              </div>
            </div>
            {hasSeparateLocalPreview ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Lokal Önizleme Linki</div>
                <div style={{ fontSize: 12, color: 'var(--app-text)', wordBreak: 'break-all' }}>{previewLink}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={copyPreviewLink} disabled={!previewLink}>Lokal Linki Kopyala</button>
                  <a className="btn" href={previewLink || '#'} target="_blank" rel="noreferrer" onClick={(event) => { if (!previewLink) event.preventDefault() }}>Lokalde Aç</a>
                </div>
              </div>
            ) : null}
            {settings.qrMenu?.tableQrEnabled ? (
              <div style={{ display: 'grid', gap: 8, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ padding: '10px 14px', borderRadius: 16, border: `1px solid ${pageTheme.cardBorder}`, background: 'var(--app-surface-2, var(--app-surface-soft))', fontWeight: 800 }}>
                    Masa: {selectedTable ? getTableLabel(selectedTable) : '-'}
                  </div>
                  <button className="btn" type="button" onClick={() => setTablePickerOpen((prev) => !prev)}>
                    Masa Seç
                  </button>
                </div>
                {tablePickerOpen ? (
                  <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto', padding: 10, borderRadius: 18, border: `1px solid ${pageTheme.cardBorder}`, background: 'var(--app-surface)' }}>
                    <button className="btn" type="button" onClick={() => { setSelectedTableId(''); setTablePickerOpen(false) }}>
                      Genel QR
                    </button>
                    {qrTables.map((table) => (
                      <button
                        key={table.id}
                        className="btn"
                        type="button"
                        onClick={() => {
                          setSelectedTableId(String(table.id || ''))
                          setTablePickerOpen(false)
                        }}
                      >
                        {getTableLabel(table)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={{ color: settings.qrMenu?.enabled ? 'var(--theme-accent)' : '#b91c1c', fontWeight: 900 }}>
              {settings.qrMenu?.enabled ? 'QR Menü Yayında' : 'QR Menü Kapalı'}
            </div>
            <div style={{ color: 'var(--app-text)', fontWeight: 700 }}>
              {settings.qrMenu?.tableQrEnabled ? (selectedTable?.name ? `${selectedTable.name} için masa QR hazırlanıyor.` : 'Masa bazlı QR açık. Masa seçerek özel QR üretebilirsiniz.') : 'Tek public QR akışı aktif.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" style={{ width: isMobilePortrait || isTablet ? 'min(220px, 100%)' : 220, height: isMobilePortrait || isTablet ? 'auto' : 220, aspectRatio: '1 / 1', borderRadius: 28, border: `1px solid ${pageTheme.cardBorder}`, background: 'var(--app-surface)', padding: 14, boxShadow: '0 16px 30px rgba(15, 23, 42, 0.18)' }} />
          ) : (
            <div style={{ width: isMobilePortrait || isTablet ? 'min(220px, 100%)' : 220, height: isMobilePortrait || isTablet ? 'auto' : 220, minHeight: 220, aspectRatio: '1 / 1', borderRadius: 28, border: `1px solid ${pageTheme.cardBorder}`, display: 'grid', placeItems: 'center', background: 'var(--app-surface)', color: 'var(--app-text)', fontWeight: 800 }}>
              QR hazırlanıyor
            </div>
          )}
          <button className="btn" onClick={downloadQr} disabled={!qrDataUrl}>
            QR İndir
          </button>
        </div>
      </section>

      <section style={{ ...cardStyle(), minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>Gerçek menü önizlemesi</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>Önizleme, kaydedilmiş işletme ayarlarını ve herkese açık menü API’sindeki gerçek ürün/kategori verilerini gösterir.</div>
        {(previewLink || liveLink) ? (
          <iframe
            key={previewRevision}
            title={`${tenant?.name || 'İşletme'} QR menü önizlemesi`}
            src={previewLink || liveLink}
            style={{ width: '100%', height: isCompact ? 620 : 760, border: `1px solid ${pageTheme.cardBorder}`, borderRadius: 18, background: '#f9f6f1' }}
            loading="lazy"
          />
        ) : <div>Menü önizlemesi için public bağlantı oluşturulamadı.</div>}
      </section>
    </div>
  )
}
