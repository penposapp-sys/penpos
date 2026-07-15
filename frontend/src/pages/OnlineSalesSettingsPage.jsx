import React, { useEffect, useMemo, useState } from 'react'
import { api, clearApiCache } from '../lib/apiClient.js'
import { mergeBusinessSettings, buildSafeBusinessSettings } from '../lib/businessSettings.js'
import { toast } from '../lib/toast.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { buildPublicAppUrl } from '../lib/publicAppUrl.js'

const switches = [
  ['enabled', 'Online satis aktif', 'Public siparis sayfasini acar veya kapatir.'],
  ['showLogo', 'Logo goster', 'Public satis sayfasinda isletme logosunu gosterir.'],
  ['showPrices', 'Fiyatlari goster', 'Urun kartlari ve sepet ozetinde fiyatlari gosterir.'],
  ['showDescriptions', 'Aciklamalari goster', 'Urun aciklamalarini public tarafta gorunur tutar.'],
  ['autoSendToKitchen', 'Siparisi otomatik mutfaga gonder', 'Siparis gelir gelmez paket akisina ve mutfaga dusurur.'],
  ['allowCustomerNote', 'Musteri notu acik', 'Musterinin siparis notu birakmasina izin verir.'],
]

const baseCardStyle = {
  border: '1px solid var(--app-border)',
  background: 'var(--app-surface)',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
}

function ToggleCard({ label, description, checked, onChange, compact = false, disabled = false }) {
  return (
    <label
      style={{
        minHeight: compact ? 70 : 82,
        borderRadius: compact ? 16 : 20,
        border: `1px solid ${checked ? 'var(--theme-accent)' : 'var(--app-border)'}`,
        background: checked
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--app-surface)), var(--app-surface))'
          : 'linear-gradient(135deg, var(--app-surface), var(--app-surface-2, var(--app-surface)))',
        padding: compact ? '12px 13px' : '14px 16px',
        display: 'flex',
        flexDirection: compact ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: compact ? 'flex-start' : 'center',
        gap: compact ? 10 : 12,
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontWeight: 900, fontSize: compact ? 14 : 16 }}>{label}</div>
        <div style={{ fontSize: compact ? 11 : 12, color: 'var(--app-text-secondary, var(--muted))' }}>{description}</div>
      </div>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ position: 'absolute', opacity: 0 }} />
        <span
          style={{
            height: compact ? 30 : 34,
            width: compact ? 56 : 62,
            borderRadius: 999,
            background: checked ? 'var(--theme-gradient)' : 'var(--app-surface-3, var(--app-button-bg))',
            padding: 4,
            display: 'flex',
            justifyContent: checked ? 'flex-end' : 'flex-start',
          }}
        >
          <span style={{ width: compact ? 22 : 26, height: compact ? 22 : 26, borderRadius: 999, background: '#fff' }} />
        </span>
      </span>
    </label>
  )
}

export default function OnlineSalesSettingsPage() {
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const compact = isMobilePortrait || isTablet
  const cardStyle = useMemo(() => ({
    ...baseCardStyle,
    borderRadius: compact ? 18 : 24,
    padding: compact ? 12 : 16,
  }), [compact])
  const inputStyle = useMemo(() => ({
    minHeight: compact ? 44 : 48,
    borderRadius: compact ? 14 : 16,
    border: '1px solid var(--app-border)',
    background: 'var(--app-input)',
    color: 'var(--app-text)',
    padding: compact ? '0 12px' : '0 14px',
    fontWeight: 700,
    fontSize: compact ? 13 : 14,
  }), [compact])

  const [tenant, setTenant] = useState(null)
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState(() => mergeBusinessSettings())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [profileRes, businessRes, branchesRes, productsRes] = await Promise.all([
        api('/api/tenant/profile', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/settings/business', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/settings/business/branches', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api('/api/tenant/menu-items?active=true', { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
      ])

      if (profileRes?.success === false) throw new Error(profileRes?.message || 'Ayarlar yuklenemedi')
      if (businessRes?.success === false) throw new Error(businessRes?.message || 'Ayarlar yuklenemedi')

      setTenant(profileRes?.tenant || null)
      setSettings(mergeBusinessSettings(businessRes?.settings || profileRes?.tenant?.settings || {}))
      setBranches(Array.isArray(branchesRes?.branches) ? branchesRes.branches : [])
      setProducts(Array.isArray(productsRes?.items) ? productsRes.items : [])
    } catch (err) {
      setError(err?.message || 'Ayarlar yuklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onlineSales = settings?.onlineSales || {}
  const publicBaseLink = useMemo(() => {
    const slug = String(tenant?.slug || '').trim()
    if (!slug) return ''
    return buildPublicAppUrl(`/online/${slug}`)
  }, [tenant?.slug])
  const branchLinks = useMemo(() => (
    (branches || []).map((branch) => {
      const id = String(branch?.id || branch?._id || '').trim()
      const name = String(branch?.name || 'Sube').trim() || 'Sube'
      return {
        id,
        name,
        url: publicBaseLink && id ? `${publicBaseLink}?branchId=${encodeURIComponent(id)}` : ''
      }
    }).filter((entry) => entry.id && entry.url)
  ), [branches, publicBaseLink])
  const selectedProductName = useMemo(() => {
    const found = products.find((item) => String(item?.id || item?._id || '') === String(onlineSales?.featuredProductId || ''))
    return found?.name || ''
  }, [products, onlineSales?.featuredProductId])

  const setOnlineSalesValue = (key, value) => {
    setSettings((current) => ({
      ...current,
      onlineSales: {
        ...(current?.onlineSales || {}),
        [key]: value,
      },
    }))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const safeSettings = buildSafeBusinessSettings(settings, { onlineSales: settings?.onlineSales || {} })
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
      if (res?.success === false) throw new Error(res?.message || 'Ayarlar kaydedilemedi')
      clearApiCache()
      setSettings(mergeBusinessSettings(res?.settings || safeSettings))
      toast.success('Online satis ayarlari kaydedildi')
    } catch (err) {
      setError(err?.message || 'Ayarlar kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async (url) => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Online satis linki kopyalandi')
    } catch {
      toast.error('Link kopyalanamadi')
    }
  }

  return (
    <div style={{ display: 'grid', gap: compact ? 12 : 16 }}>
      <section style={{ ...cardStyle, display: 'grid', gap: compact ? 12 : 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: compact ? 22 : 28, fontWeight: 900, letterSpacing: '-0.03em' }}>Online Satis</div>
            <div style={{ marginTop: 6, fontSize: compact ? 12 : 13, color: 'var(--app-text-secondary, var(--muted))' }}>
              QR menuden ayri calisan public siparis yuzeyini buradan yonetebilirsiniz.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'stretch' : 'flex-end' }}>
            <button className="btn" type="button" onClick={load} disabled={loading || saving}>{loading ? 'Yukleniyor...' : 'Yenile'}</button>
            <button className="btn btn--primary" type="button" onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </div>

        {error ? (
          <div style={{ borderRadius: compact ? 14 : 16, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', padding: compact ? '10px 12px' : '12px 14px', fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {switches.map(([key, label, description]) => (
            <ToggleCard
              key={key}
              label={label}
              description={description}
              checked={!!onlineSales?.[key]}
              onChange={(event) => setOnlineSalesValue(key, event.target.checked)}
              compact={compact}
              disabled={saving}
            />
          ))}
        </div>
      </section>

      <section style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: compact ? 16 : 18, fontWeight: 900 }}>Iletisim Bilgileri</div>
        <div style={{ fontSize: compact ? 12 : 13, color: 'var(--app-text-secondary, var(--muted))' }}>
          Online satis sayfasindaki Iletisim sekmesinde bu bilgiler gosterilir.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 700 }}>Telefon</span>
            <input className="input" value={String(onlineSales?.phone || '')} onChange={(event) => setOnlineSalesValue('phone', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 700 }}>WhatsApp</span>
            <input className="input" value={String(onlineSales?.whatsapp || '')} onChange={(event) => setOnlineSalesValue('whatsapp', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 700 }}>E-posta</span>
            <input className="input" value={String(onlineSales?.email || '')} onChange={(event) => setOnlineSalesValue('email', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 700 }}>Calisma Saatleri</span>
            <input className="input" value={String(onlineSales?.workingHours || '')} onChange={(event) => setOnlineSalesValue('workingHours', event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: compact ? 'auto' : '1 / -1' }}>
            <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 700 }}>Adres</span>
            <textarea
              className="input"
              rows={3}
              value={String(onlineSales?.address || '')}
              onChange={(event) => setOnlineSalesValue('address', event.target.value)}
              style={{ ...inputStyle, minHeight: compact ? 82 : 92, padding: 14, resize: 'vertical' }}
            />
          </label>
        </div>
      </section>

      <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: compact ? 16 : 18, fontWeight: 900 }}>Yayin Bilgisi</div>
          <div style={{ fontSize: compact ? 12 : 13, color: 'var(--app-text-secondary, var(--muted))' }}>
            One cikan urun: <strong>{selectedProductName || 'Otomatik'}</strong>
          </div>
          <div style={{ fontSize: compact ? 12 : 13, color: onlineSales?.enabled ? 'var(--theme-accent)' : '#b91c1c', fontWeight: 800 }}>
            {onlineSales?.enabled ? 'Online satis yayinda' : 'Online satis kapali'}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {branchLinks.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: '1px solid var(--app-border)',
                borderRadius: compact ? 16 : 20,
                background: 'var(--app-surface-2, var(--app-surface))',
                padding: compact ? 10 : 14,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: compact ? 14 : 15 }}>{entry.name}</strong>
                <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Online siparis alani</span>
              </div>
              <div style={{ wordBreak: 'break-all', fontSize: compact ? 12 : 13 }}>{entry.url}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'stretch' : 'flex-end' }}>
                <button className="btn" type="button" onClick={() => copyLink(entry.url)} disabled={!entry.url}>Linki Kopyala</button>
                {entry.url ? <a className="btn" href={entry.url} target="_blank" rel="noreferrer">Sayfayi Ac</a> : null}
              </div>
            </div>
          ))}

          {branchLinks.length === 0 ? (
            <div style={{ borderRadius: compact ? 14 : 16, border: '1px solid var(--app-border)', padding: compact ? '10px 12px' : '12px 14px', color: 'var(--app-text-secondary, var(--muted))' }}>
              Online satis sayfasi olusturmak icin once aktif sube ekleyin.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
