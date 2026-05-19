import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import QRCode from 'qrcode'
import { buildSafeBusinessSettings, mergeBusinessSettings } from '../lib/businessSettings.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

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

const qrThemeModes = [
  ['light', 'Beyaz', 'Açık zeminli klasik QR müşteri görünümü.'],
  ['dark', 'Dark', 'Kart ve çerçeveleri koyu QR temasıyla gösterir.'],
]

function cardStyle() {
  return {
    borderRadius: 30,
    border: `1px solid ${pageTheme.cardBorder}`,
    background: 'var(--app-surface)',
    boxShadow: pageTheme.shadow,
    padding: 20,
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

function ToggleItem({ label, description, checked, onChange, disabled }) {
  return (
    <label
      style={{
        minHeight: 76,
        borderRadius: 26,
        padding: '14px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 14,
        alignItems: 'center',
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

function OptionCard({ title, description, active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 104,
        borderRadius: 24,
        border: `1px solid ${active ? 'var(--theme-accent)' : 'var(--app-border)'}`,
        background: active
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 16%, var(--app-surface-soft)), var(--app-surface))'
          : 'linear-gradient(135deg, var(--app-surface), var(--app-surface-2, var(--app-surface-soft)))',
        color: 'var(--app-text)',
        textAlign: 'left',
        padding: '16px 18px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: active ? 'var(--theme-active-glow)' : 'none',
        display: 'grid',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 900 }}>{title}</span>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--app-text-secondary, var(--app-text))' }}>{description}</span>
    </button>
  )
}

export default function QrMenuSettingsPage() {
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [settings, setSettings] = useState(() => mergeBusinessSettings())
  const [qrDataUrl, setQrDataUrl] = useState('')

  const link = useMemo(() => {
    const slug = String(tenant?.slug || '').trim()
    if (!slug) return ''
    return `${window.location.origin}/menu/${slug}`
  }, [tenant?.slug])

  useEffect(() => {
    if (!link) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(link, { width: 320, margin: 2 }, (err, url) => {
      if (!err) setQrDataUrl(url)
    })
  }, [link])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/api/tenant/profile', { silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setTenant(null)
        setSettings(mergeBusinessSettings())
        setError(res?.message || 'Bu işlem için yetkiniz yok')
        return
      }
      const nextTenant = res?.tenant || null
      setTenant(nextTenant)
      setSettings(mergeBusinessSettings(nextTenant?.settings || {}))
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
      const res = await api('/api/tenant/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: safeSettings }),
        silent: true,
        skipBranchHeader: true,
      })
      if (res?.success === false) {
        setError(res?.message || 'QR ayarları kaydedilemedi')
        return
      }
      setSettings(mergeBusinessSettings(res?.tenant?.settings || safeSettings))
      toast.success('QR ayarları kaydedildi')
    } catch (err) {
      setError(err?.message || 'QR ayarları kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Public link kopyalandı')
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = link
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

  const downloadQr = () => {
    if (!qrDataUrl) return
    const anchor = document.createElement('a')
    anchor.href = qrDataUrl
    anchor.download = `qr-menü-${tenant?.slug || 'tenant'}.png`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  return (
    <div style={{ background: pageTheme.pageBg, borderRadius: 32, padding: 20, border: `1px solid ${pageTheme.cardBorder}`, boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)', display: 'grid', gap: 16, color: 'var(--app-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--app-text)' }}>QR Menü</div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--app-text)', maxWidth: 700 }}>
            Public link, QR görseli ve yayın tercihleri mevcut tenant ayarları üstüne geriye dönük uyumlu olarak kaydedilir.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={load} disabled={loading || saving}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>
          <SaveButton onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'QR Ayarlarını Kaydet'}</SaveButton>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle(), borderColor: '#ef4444', background: 'color-mix(in srgb, #ef4444 14%, var(--app-surface))', color: '#fca5a5', fontWeight: 800, padding: '12px 16px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobilePortrait ? 240 : 320}px, 1fr))`, gap: 16 }}>
        <section style={cardStyle()}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>QR Yayın Ayarları</div>
          <div style={{ fontSize: 12, color: 'var(--app-text)', marginBottom: 16 }}>Logo, kapak, açıklama, masa QR ve garson çağır blokları bu kartta toplanır.</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {qrSwitches.map(([key, label, description]) => (
              <ToggleItem
                key={key}
                label={label}
                description={description}
                checked={!!settings.qrMenu?.[key]}
                onChange={(e) => setQrValue(key, e.target.checked)}
                disabled={saving}
              />
            ))}
          </div>
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>QR Tema Modu</div>
          <div style={{ fontSize: 12, color: 'var(--app-text)', marginBottom: 16 }}>
            Müşteri QR sayfasında beyaz veya dark görünüm kullanın. Dark mod kart, çerçeve ve modal yüzeylerini de koyulaştırır.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {qrThemeModes.map(([value, label, description]) => (
              <OptionCard
                key={value}
                title={label}
                description={description}
                active={(settings.qrMenu?.themeMode || 'light') === value}
                onClick={() => setQrValue('themeMode', value)}
                disabled={saving}
              />
            ))}
          </div>
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>Public Link & Kod</div>
          <div style={{ fontSize: 12, color: 'var(--app-text)', marginBottom: 16 }}>İşletme kodu, paylaşılan menü adresi ve indirme/kopyalama aksiyonları korunur.</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--app-text)', fontWeight: 900 }}>İşletme Kodu</span>
              <input style={inputStyle()} value={String(tenant?.slug || '')} readOnly />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--app-text)', fontWeight: 900 }}>Public Link</span>
              <input style={inputStyle()} value={link} readOnly />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={copyLink} disabled={!link}>Linki Kopyala</button>
              <button className="btn" onClick={downloadQr} disabled={!qrDataUrl}>QR İndir</button>
            </div>
          </div>
        </section>
      </div>

      <section style={{ ...cardStyle(), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--app-text)', marginBottom: 6 }}>QR Önizleme</div>
          <div style={{ fontSize: 13, color: 'var(--app-text)', marginBottom: 12 }}>
            Kaydetmeden önce linkin doğru tenant'a ve doğru slug'a gittiğini kontrol edebilirsiniz.
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ padding: 14, borderRadius: 20, border: `1px solid ${pageTheme.cardBorder}`, background: 'var(--app-surface-2, var(--app-surface-soft))' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--app-text)', fontWeight: 900 }}>Durum</div>
              <div style={{ marginTop: 6, fontWeight: 900, color: settings.qrMenu?.enabled ? 'var(--theme-accent)' : '#b91c1c' }}>
                {settings.qrMenu?.enabled ? 'QR Menü Yayında' : 'QR Menü Kapalı'}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 20, border: `1px solid ${pageTheme.cardBorder}`, background: 'var(--app-surface-2, var(--app-surface-soft))' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--app-text)', fontWeight: 900 }}>Ek Bilgi</div>
              <div style={{ marginTop: 6, color: 'var(--app-text)', fontWeight: 700 }}>
                {settings.qrMenu?.tableQrEnabled ? 'Masa bazlı QR açık.' : 'Tek public QR akışı aktif.'}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 20, border: `1px solid ${pageTheme.cardBorder}`, background: 'var(--app-surface-2, var(--app-surface-soft))' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--app-text)', fontWeight: 900 }}>Tema</div>
              <div style={{ marginTop: 6, color: 'var(--app-text)', fontWeight: 700 }}>
                {(settings.qrMenu?.themeMode || 'light') === 'dark' ? 'Dark mod aktif.' : 'Beyaz mod aktif.'}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', justifyItems: 'center' }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" style={{ width: isMobilePortrait || isTablet ? 'min(220px, 100%)' : 220, height: isMobilePortrait || isTablet ? 'auto' : 220, aspectRatio: '1 / 1', borderRadius: 28, border: `1px solid ${pageTheme.cardBorder}`, background: 'var(--app-surface)', padding: 14, boxShadow: '0 16px 30px rgba(15, 23, 42, 0.18)' }} />
          ) : (
            <div style={{ width: isMobilePortrait || isTablet ? 'min(220px, 100%)' : 220, height: isMobilePortrait || isTablet ? 'auto' : 220, minHeight: 220, aspectRatio: '1 / 1', borderRadius: 28, border: `1px solid ${pageTheme.cardBorder}`, display: 'grid', placeItems: 'center', background: 'var(--app-surface)', color: 'var(--app-text)', fontWeight: 800 }}>
              QR hazırlanıyor
            </div>
          )}
        </div>
      </section>
    </div>
  )
}


