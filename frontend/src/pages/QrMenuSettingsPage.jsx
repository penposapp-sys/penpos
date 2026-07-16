import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { clearApiCache } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import QRCode from 'qrcode'
import { buildSafeBusinessSettings, mergeBusinessSettings } from '../lib/businessSettings.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { buildPublicAppUrl } from '../lib/publicAppUrl.js'

const pageTheme = {
  pageBg: 'radial-gradient(circle at top left, color-mix(in srgb, var(--theme-accent) 18%, transparent) 0, transparent 32%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--theme-accent-hover) 14%, transparent) 0, transparent 28%), var(--app-bg)',
  cardBorder: 'var(--app-border)',
  shadow: '0 18px 50px rgba(15, 23, 42, 0.18)',
}

const qrSwitches = [
  ['enabled', 'QR Menü aç/kapat', 'Public menü yayınının aktif olup olmayacağını belirler.'],
  ['showLogo', 'Logo gösterimi', 'Kapakta ve üst alanda işletme logosunu gösterir.'],
  ['showCoverImage', 'Kapak fotoğrafı', 'Menü açılış kapağını görünür tutar.'],
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
  const [settings, setSettings] = useState(() => mergeBusinessSettings())
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrTables, setQrTables] = useState([])
  const [products, setProducts] = useState([])
  const [selectedTableId, setSelectedTableId] = useState('')
  const [tablePickerOpen, setTablePickerOpen] = useState(false)

  const selectedTable = useMemo(
    () => qrTables.find((table) => String(table?.id || '') === String(selectedTableId || '')) || null,
    [qrTables, selectedTableId]
  )

  const liveLink = useMemo(() => {
    const slug = String(tenant?.slug || '').trim()
    if (!slug) return ''
    const next = new URL(buildPublicAppUrl(`/menu/${slug}`))
    if (settings.qrMenu?.tableQrEnabled && selectedTable?.id) {
      next.searchParams.set('tableId', String(selectedTable.id))
      next.searchParams.set('table', String(selectedTable.name || ''))
    }
    return next.toString()
  }, [tenant?.slug, settings.qrMenu?.tableQrEnabled, selectedTable])

  const previewLink = useMemo(() => {
    const slug = String(tenant?.slug || '').trim()
    if (!slug) return ''
    const next = new URL(buildPublicAppUrl(`/menu/${slug}`, null, { originMode: 'current' }))
    if (settings.qrMenu?.tableQrEnabled && selectedTable?.id) {
      next.searchParams.set('tableId', String(selectedTable.id))
      next.searchParams.set('table', String(selectedTable.name || ''))
    }
    return next.toString()
  }, [tenant?.slug, settings.qrMenu?.tableQrEnabled, selectedTable])

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
      const [profileRes, businessRes, tablesRes, productsRes] = await Promise.all([
        api('/api/tenant/profile', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/settings/business', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/settings/business/qr-tables', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/tenant/menu-items?active=true', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
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
      const nextTenant = profileRes?.tenant || null
      setTenant(nextTenant)
      setSettings(mergeBusinessSettings(businessRes?.settings || nextTenant?.settings || {}))
      const nextTables = Array.isArray(tablesRes?.tables) ? tablesRes.tables : []
      const nextProducts = Array.isArray(productsRes?.items) ? productsRes.items : []
      setQrTables(nextTables)
      setProducts(nextProducts)
      setSelectedTableId((prev) => {
        if (prev && nextTables.some((table) => String(table?.id || '') === String(prev))) return prev
        return ''
      })
    } catch (err) {
      setTenant(null)
      setSettings(mergeBusinessSettings())
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
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div style={{ borderRadius: 22, border: `1px solid ${pageTheme.cardBorder}`, background: 'linear-gradient(135deg, var(--app-surface), var(--app-surface-2, var(--app-surface-soft)))', padding: 14, display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>QR Tema Modu</div>
                <div style={{ fontSize: 12, color: 'var(--app-text)' }}>
                  Tek butonla koyu modu aktif veya pasif yapin. Koyu mod kart, cerceve ve modal yuzeylerini de koyulastirir.
                </div>
              </div>
              <ToggleItem
                label="Koyu mod"
                description={settings.qrMenu?.themeMode === 'dark' ? 'Koyu mod aktif.' : 'Koyu mod pasif.'}
                checked={(settings.qrMenu?.themeMode || 'light') === 'dark'}
                onChange={(e) => setQrValue('themeMode', e.target.checked ? 'dark' : 'light')}
                disabled={saving}
                compact={false}
              />
            </div>

            <div style={{ borderRadius: 22, border: `1px solid ${pageTheme.cardBorder}`, background: 'linear-gradient(135deg, var(--app-surface), var(--app-surface-2, var(--app-surface-soft)))', padding: 14, display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>Bugunun Onerisi</div>
                <div style={{ fontSize: 12, color: 'var(--app-text)' }}>
                  QR menu acilisinda gorunen oneri urununu buradan secin.
                </div>
              </div>
              <select
                value={String(settings.qrMenu?.featuredProductId || '')}
                onChange={(event) => setQrValue('featuredProductId', String(event.target.value || ''))}
                disabled={saving}
                style={{ ...inputStyle(), fontWeight: 800 }}
              >
                <option value="">Otomatik secim</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 700 }}>
                {featuredProduct ? `Secili urun: ${featuredProduct.name}` : 'Secim yapilmazsa listedeki ilk uygun urun kullanilir.'}
              </div>
            </div>
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
                    Masa: {selectedTable?.name || '-'}
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
                        {table.name}
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
    </div>
  )
}


