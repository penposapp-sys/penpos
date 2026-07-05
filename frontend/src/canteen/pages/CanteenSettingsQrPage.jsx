import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import { qrThemes } from '../components/CanteenQrPreview.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import ProductImageUploadField from '../../components/ProductImageUploadField.jsx'
import { optimizeProductImageForUpload } from '../../lib/productImage.js'

const getSelectedTheme = (themeId) => qrThemes.find((item) => item.id === themeId) || qrThemes[0]

const FIELD_LABEL_STYLE = {
  fontSize: 12,
  fontWeight: 900,
  color: 'var(--app-text-secondary, var(--muted))'
}

const TEXTAREA_STYLE = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--theme-accent) 14%, var(--app-border))',
  padding: '12px 14px',
  fontWeight: 700,
  resize: 'vertical'
}

const SOFT_CARD_STYLE = {
  borderRadius: 28,
  padding: 22,
  border: '1px solid color-mix(in srgb, var(--theme-accent) 14%, var(--app-border))',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 98%, transparent), color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 96%, transparent))',
  boxShadow: 'var(--card-shadow)'
}

export default function CanteenSettingsQrPage() {
  const { me } = useOutletContext()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const canManage = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('manage_settings'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenant, setTenant] = useState(null)
  const [settings, setSettings] = useState({
    qrTitle: '',
    qrDescription: '',
    qrCoverImageUrl: '',
    qrPhone: '',
    qrWhatsapp: '',
    qrEmail: '',
    qrAddress: '',
    qrWorkingHours: '',
    qrTheme: 'light'
  })
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [message, setMessage] = useState('')
  const [qrCodeMap, setQrCodeMap] = useState({})
  const [qrCoverFile, setQrCoverFile] = useState(null)
  const [qrCoverError, setQrCoverError] = useState('')
  const [qrCoverRemovePending, setQrCoverRemovePending] = useState(false)
  const isCompact = isMobilePortrait || isTablet

  const visibleBranches = useMemo(() => {
    const active = (Array.isArray(branches) ? branches : []).filter((branch) => branch.isActive !== false)
    if (active.length > 0) return active
    return Array.isArray(branches) ? branches : []
  }, [branches])

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setMessage('')
    const [profileResponse, settingsResponse] = await Promise.all([
      api('/api/tenant/profile', { silent: true }),
      api('/api/canteen/settings', { silent: true })
    ])

    if (!profileResponse?.ok || !settingsResponse?.ok) {
      if (!background) setLoading(false)
      toast.error('QR ayarlari yuklenemedi')
      return
    }

    const nextTenant = profileResponse.tenant || null
    const nextSettings = settingsResponse.settings || {}
    const nextBranches = Array.isArray(nextTenant?.branches) ? nextTenant.branches : []
    const allowedBranchIds = Array.isArray(nextSettings.allowedBranchIds) ? nextSettings.allowedBranchIds.map(String) : []
    const filteredBranches = allowedBranchIds.length > 0
      ? nextBranches.filter((branch) => allowedBranchIds.includes(String(branch.id || branch._id || '')))
      : nextBranches
    const initialBranchId = String(
      nextSettings.defaultBranchId ||
      filteredBranches[0]?.id ||
      filteredBranches[0]?._id ||
      ''
    )

    setTenant(nextTenant)
    setSettings({
      qrTitle: String(nextSettings.qrTitle || nextTenant?.name || ''),
      qrDescription: String(nextSettings.qrDescription || nextTenant?.description || ''),
      qrCoverImageUrl: String(nextSettings.qrCoverImageUrl || ''),
      qrPhone: String(nextSettings.qrPhone || ''),
      qrWhatsapp: String(nextSettings.qrWhatsapp || ''),
      qrEmail: String(nextSettings.qrEmail || ''),
      qrAddress: String(nextSettings.qrAddress || ''),
      qrWorkingHours: String(nextSettings.qrWorkingHours || ''),
      qrTheme: String(nextSettings.qrTheme || 'light')
    })
    setBranches(filteredBranches)
    setSelectedBranchId(initialBranchId)
    setQrCoverFile(null)
    setQrCoverError('')
    setQrCoverRemovePending(false)
    if (!background) setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const uploadQrMedia = async (kind, file, branchId) => {
    const optimizedFile = await optimizeProductImageForUpload(file)
    const body = new FormData()
    body.append('file', optimizedFile || file)
    return api(`/api/canteen/settings/qr/${kind}?branchId=${encodeURIComponent(branchId)}`, {
      method: 'POST',
      body,
      silent: true
    })
  }

  const removeQrMedia = async (kind, branchId) => (
    api(`/api/canteen/settings/qr/${kind}?branchId=${encodeURIComponent(branchId)}`, {
      method: 'DELETE',
      silent: true
    })
  )

  const save = async () => {
    const saveBranchId = String(selectedBranchId || visibleBranches[0]?.id || visibleBranches[0]?._id || '').trim()
    if (!saveBranchId) {
      toast.error('Once bir sube secmelisin')
      return
    }

    setSaving(true)
    setMessage('')
    const response = await api(`/api/canteen/settings/qr?branchId=${encodeURIComponent(saveBranchId)}`, {
      method: 'PUT',
      data: {
        qrTitle: settings.qrTitle,
        qrDescription: settings.qrDescription,
        qrCoverImageUrl: settings.qrCoverImageUrl,
        qrPhone: settings.qrPhone,
        qrWhatsapp: settings.qrWhatsapp,
        qrEmail: settings.qrEmail,
        qrAddress: settings.qrAddress,
        qrWorkingHours: settings.qrWorkingHours,
        qrTheme: settings.qrTheme
      },
      silent: true
    })
    setSaving(false)

    if (!response?.ok) {
      toast.error(response?.message || 'QR ayarlari kaydedilemedi')
      return
    }

    setMessage('QR ayarları kaydedildi.')
    toast.success('QR ayarlari kaydedildi')
  }

  const saveWithMedia = async () => {
    const saveBranchId = String(selectedBranchId || visibleBranches[0]?.id || visibleBranches[0]?._id || '').trim()
    if (!saveBranchId) {
      toast.error('Once bir sube secmelisin')
      return
    }

    setSaving(true)
    setMessage('')

    let nextQrCoverImageUrl = settings.qrCoverImageUrl

    try {
      if (qrCoverRemovePending && !qrCoverFile && settings.qrCoverImageUrl) {
        const removeCoverResponse = await removeQrMedia('cover', saveBranchId)
        if (!removeCoverResponse?.ok) {
          setSaving(false)
          toast.error(removeCoverResponse?.message || 'QR kapak gorseli kaldirilamadi')
          return
        }
        nextQrCoverImageUrl = ''
      }

      if (qrCoverFile) {
        const uploadCoverResponse = await uploadQrMedia('cover', qrCoverFile, saveBranchId)
        if (!uploadCoverResponse?.ok) {
          setSaving(false)
          toast.error(uploadCoverResponse?.message || 'QR kapak gorseli yuklenemedi')
          return
        }
        nextQrCoverImageUrl = String(uploadCoverResponse?.imageUrl || uploadCoverResponse?.settings?.qrCoverImageUrl || '')
      }
    } catch (err) {
      setSaving(false)
      toast.error(err?.message || 'QR gorselleri yuklenemedi')
      return
    }

    const response = await api(`/api/canteen/settings/qr?branchId=${encodeURIComponent(saveBranchId)}`, {
      method: 'PUT',
      data: {
        qrTitle: settings.qrTitle,
        qrDescription: settings.qrDescription,
        qrCoverImageUrl: nextQrCoverImageUrl,
        qrPhone: settings.qrPhone,
        qrWhatsapp: settings.qrWhatsapp,
        qrEmail: settings.qrEmail,
        qrAddress: settings.qrAddress,
        qrWorkingHours: settings.qrWorkingHours,
        qrTheme: settings.qrTheme
      },
      silent: true
    })
    setSaving(false)

    if (!response?.ok) {
      toast.error(response?.message || 'QR ayarlari kaydedilemedi')
      return
    }

    setSettings((current) => ({
      ...current,
      qrCoverImageUrl: nextQrCoverImageUrl
    }))
    setQrCoverFile(null)
    setQrCoverError('')
    setQrCoverRemovePending(false)
    setMessage('QR ayarlari kaydedildi.')
    toast.success('QR ayarlari kaydedildi')
  }

  const selectedTheme = getSelectedTheme(settings.qrTheme)
  const publicBranchCards = useMemo(() => {
    if (!tenant?.slug) return []
    return visibleBranches.map((branch) => {
      const branchId = String(branch.id || branch._id || '').trim()
      const branchName = String(branch.name || '').trim() || 'Sube'
      const branchSlug = String(branch.publicSlug || tenant.slug || '').trim()
      const publicUrl = `${window.location.origin}/qr/${branchSlug}`
      return {
        id: branchId,
        name: branchName,
        description: String(branch.description || '').trim(),
        publicUrl
      }
    })
  }, [tenant?.slug, visibleBranches])

  useEffect(() => {
    if (publicBranchCards.length === 0) {
      setQrCodeMap({})
      return
    }
    let cancelled = false
    Promise.all(publicBranchCards.map(async (branch) => {
      try {
        const url = await QRCode.toDataURL(branch.publicUrl, { width: 320, margin: 2 })
        return [branch.id, url]
      } catch {
        return [branch.id, '']
      }
    })).then((entries) => {
      if (cancelled) return
      setQrCodeMap(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [publicBranchCards])

  if (loading) return <div className="card">Yukleniyor...</div>

  return (
    <div className="canteen-settings-qr-page" style={{ display: 'grid', gap: 18 }}>
      <style>{`
        .canteen-settings-qr-page .card {
          background: linear-gradient(180deg, var(--app-surface), var(--app-surface-soft, var(--panelElevated))) !important;
          color: var(--app-text) !important;
          box-shadow: var(--card-shadow) !important;
        }
        .canteen-settings-qr-page input,
        .canteen-settings-qr-page textarea,
        .canteen-settings-qr-page select {
          background: var(--app-surface) !important;
          color: var(--app-text) !important;
          border-color: var(--app-border, var(--border)) !important;
        }
        .canteen-settings-qr-page button:not(.qr-theme-card) {
          color: var(--settings-button-text, #ffffff) !important;
        }
        .canteen-settings-qr-page a {
          color: var(--app-text) !important;
        }
        .canteen-settings-qr-page .public-qr-open-link {
          border: 1px solid color-mix(in srgb, var(--theme-accent) 14%, var(--app-border)) !important;
          background: color-mix(in srgb, var(--app-surface) 94%, transparent) !important;
          color: var(--app-text) !important;
          box-shadow: none !important;
        }
        .canteen-settings-qr-page .public-qr-open-link:hover {
          background: color-mix(in srgb, var(--theme-accent) 8%, var(--app-surface)) !important;
        }
        .canteen-settings-qr-page .qr-theme-card {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--app-surface) 98%, transparent),
            color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 96%, transparent)
          ) !important;
          color: var(--app-text) !important;
          box-shadow: 0 10px 22px color-mix(in srgb, #000 12%, transparent) !important;
        }
        .canteen-settings-qr-page .qr-theme-card::before {
          display: none !important;
          opacity: 0 !important;
        }
        .canteen-settings-qr-page .qr-theme-card.is-selected {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--theme-accent) 16%, var(--app-surface)),
            color-mix(in srgb, var(--theme-accent) 8%, var(--app-surface-soft, var(--panelElevated)))
          ) !important;
          color: var(--app-text) !important;
          box-shadow: var(--theme-active-glow) !important;
        }
        .canteen-settings-qr-page .qr-theme-card.is-selected :is(div, span, small, svg, svg *) {
          color: inherit !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        .canteen-settings-qr-page img[alt="QR Code"] {
          background: #ffffff !important;
        }
      `}</style>

      <div
        className="card"
        style={{
          padding: 24,
          borderRadius: 30,
          border: '1px solid color-mix(in srgb, var(--theme-accent) 20%, var(--app-border))',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 98%, transparent), color-mix(in srgb, var(--theme-accent) 10%, var(--app-surface-soft, var(--panelElevated))))',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: 1, color: 'var(--theme-accent)', textTransform: 'uppercase' }}>QR Ayarları</div>
            <div style={{ marginTop: 6, fontSize: 32, fontWeight: 950, color: 'var(--app-text)' }}>QR vitrininizi yönetin</div>
            <div style={{ marginTop: 8, maxWidth: 720, color: 'var(--app-text-secondary)', fontWeight: 700, lineHeight: 1.6 }}>
              Bu sayfa QR vitrini ve yayın görünümünü yönetir. Sepet, sipariş, masa veya ödeme akışını içermez.
            </div>
          </div>
          <button
            type="button"
            onClick={saveWithMedia}
            disabled={!canManage || saving}
            style={{
              border: 0,
              borderRadius: 20,
              padding: '14px 20px',
              fontWeight: 950,
              color: '#ffffff',
              background: 'var(--theme-gradient)',
              boxShadow: 'var(--theme-active-glow)'
            }}
          >
            {saving ? 'Kaydediliyor...' : 'QR Ayarlarını Kaydet'}
          </button>
        </div>
      </div>

      {!!message ? (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, #22c55e 38%, var(--app-border))', background: 'color-mix(in srgb, #22c55e 12%, var(--app-surface))', color: 'var(--app-text)' }}>
          {message}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 18 }}>
        <div className="card" style={SOFT_CARD_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 20,
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--app-surface))',
                border: '1px solid color-mix(in srgb, var(--theme-accent) 20%, var(--app-border))',
                color: 'var(--theme-accent)'
              }}
            >
              ◦
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 950, color: 'var(--app-text)' }}>Firma ve gorunum</div>
              <div style={{ marginTop: 4, color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700 }}>
                Baslik, kapak, iletisim alanlari ve tema secimi burada tutulur.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, minWidth: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL_STYLE}>Firma Adi</span>
              <input className="input" value={settings.qrTitle} onChange={(event) => setSettings((current) => ({ ...current, qrTitle: event.target.value }))} />
            </label>
            <div style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
              <span style={FIELD_LABEL_STYLE}>QR Kapak Gorseli</span>
              <ProductImageUploadField
                currentImageUrl={qrCoverRemovePending ? '' : settings.qrCoverImageUrl}
                file={qrCoverFile}
                error={qrCoverError}
                disabled={!canManage || saving}
                helperText="JPG, PNG, WEBP, AVIF veya HEIC/HEIF. Maksimum 5 MB, kapak alani icin optimize edilerek saklanir."
                onFileChange={(nextFile, validationMessage) => {
                  setQrCoverError(validationMessage || '')
                  setQrCoverFile(validationMessage ? null : nextFile)
                  if (!validationMessage) setQrCoverRemovePending(false)
                }}
                onClearFile={() => {
                  setQrCoverFile(null)
                  setQrCoverError('')
                }}
                onRemoveExisting={settings.qrCoverImageUrl ? () => {
                  setQrCoverRemovePending(true)
                  setQrCoverFile(null)
                  setQrCoverError('')
                } : undefined}
              />
            </div>
            <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
              <span style={FIELD_LABEL_STYLE}>Kisa Aciklama</span>
              <textarea
                value={settings.qrDescription}
                onChange={(event) => setSettings((current) => ({ ...current, qrDescription: event.target.value }))}
                rows={3}
                style={TEXTAREA_STYLE}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL_STYLE}>Telefon</span>
              <input className="input" value={settings.qrPhone} onChange={(event) => setSettings((current) => ({ ...current, qrPhone: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL_STYLE}>WhatsApp</span>
              <input className="input" value={settings.qrWhatsapp} onChange={(event) => setSettings((current) => ({ ...current, qrWhatsapp: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL_STYLE}>E-posta</span>
              <input className="input" value={settings.qrEmail} onChange={(event) => setSettings((current) => ({ ...current, qrEmail: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={FIELD_LABEL_STYLE}>Calisma Saatleri</span>
              <input className="input" value={settings.qrWorkingHours} onChange={(event) => setSettings((current) => ({ ...current, qrWorkingHours: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
              <span style={FIELD_LABEL_STYLE}>Adres</span>
              <textarea
                value={settings.qrAddress}
                onChange={(event) => setSettings((current) => ({ ...current, qrAddress: event.target.value }))}
                rows={2}
                style={TEXTAREA_STYLE}
              />
            </label>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            <div style={FIELD_LABEL_STYLE}>Musteri QR Siparis Sayfasi Tema Secimi</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
              {qrThemes.map((theme) => {
                const selected = theme.id === settings.qrTheme
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`qr-theme-card${selected ? ' is-selected' : ''}`}
                    onClick={() => setSettings((current) => ({ ...current, qrTheme: theme.id }))}
                    style={{
                      textAlign: 'left',
                      borderRadius: 22,
                      border: selected ? '2px solid var(--theme-accent)' : '1px solid color-mix(in srgb, var(--theme-accent) 10%, var(--app-border))',
                      padding: 14
                    }}
                    >
                    <div style={{ height: 52, borderRadius: 18, background: theme.colors.panel, border: '1px solid color-mix(in srgb, var(--app-text) 6%, transparent)' }} />
                    <div style={{ marginTop: 12, fontWeight: 900, color: 'var(--app-text)' }}>{theme.name}</div>
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary)' }}>
                      {selected ? 'Secili tema' : 'Musteri siparis sayfasinda kullan'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
            <div style={FIELD_LABEL_STYLE}>QR sayfalari sube bazli olusturulur</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>
              Yeni sube eklendiginde asagidaki listede otomatik yeni public QR satis sayfasi ve QR kodu olusur.
            </div>
          </div>
        </div>

        <div className="card" style={{ ...SOFT_CARD_STYLE, padding: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: 1, color: 'var(--theme-accent)', textTransform: 'uppercase' }}>QR Erisimi</div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 950, color: 'var(--app-text)' }}>Sube bazli QR satis sayfalari</div>
            <div style={{ marginTop: 8, color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>
              Her sube icin ayri public link ve ayri QR kod olusturulur. Personel ciktisini veya masa ustu gorselini bu kartlardan kullanabilir.
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gap: 16 }}>
            {publicBranchCards.length === 0 ? (
              <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700 }}>
                Sube veya slug bulunamadigi icin QR sayfasi listesi hazirlanamadi.
              </div>
            ) : publicBranchCards.map((branchCard) => {
              const qrDataUrl = qrCodeMap[branchCard.id] || ''
              return (
                <div
                  key={branchCard.id}
                  style={{
                    display: 'grid',
                    minWidth: 0,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                    gap: 18,
                    alignItems: 'center',
                    padding: 18,
                    borderRadius: 26,
                    border: '1px solid color-mix(in srgb, var(--theme-accent) 12%, var(--app-border))',
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-surface) 96%, transparent), color-mix(in srgb, var(--theme-accent) 8%, var(--app-surface-soft, var(--panelElevated))))',
                    boxShadow: 'var(--card-shadow)'
                  }}
                >
                  <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 20, fontWeight: 950, color: 'var(--app-text)' }}>{branchCard.name}</span>
                        <span style={{ borderRadius: 999, padding: '6px 10px', background: 'color-mix(in srgb, var(--theme-accent) 14%, transparent)', color: 'var(--theme-accent)', fontSize: 11, fontWeight: 900 }}>
                          Public QR
                        </span>
                      </div>
                      <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>
                        {branchCard.description || 'Bu sube icin musteri QR satis sayfasi.'}
                      </div>
                    </div>

                    <div style={{ minWidth: 0, maxWidth: '100%', padding: '12px 14px', borderRadius: 18, background: 'color-mix(in srgb, var(--app-surface) 92%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 86%, transparent)', display: 'grid', gap: 6, overflow: 'hidden' }}>
                      <div style={{ minWidth: 0, maxWidth: '100%', fontSize: 12, fontWeight: 800, color: 'var(--app-text)', overflowWrap: 'anywhere', wordBreak: 'break-all' }}>
                        {branchCard.publicUrl}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-secondary)' }}>
                        Sube: {branchCard.name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(branchCard.publicUrl)
                          toast.success(`${branchCard.name} QR linki kopyalandi`)
                        }}
                        style={{
                          border: '1px solid color-mix(in srgb, var(--theme-accent) 14%, var(--app-border))',
                          borderRadius: 16,
                          background: 'color-mix(in srgb, var(--app-surface) 94%, transparent)',
                          padding: '11px 14px',
                          fontWeight: 900,
                          maxWidth: '100%'
                        }}
                      >
                        Linki Kopyala
                      </button>
                      <a
                        href={branchCard.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="public-qr-open-link"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 16,
                          border: '1px solid color-mix(in srgb, var(--theme-accent) 14%, var(--app-border))',
                          background: 'color-mix(in srgb, var(--app-surface) 94%, transparent)',
                          color: 'var(--app-text)',
                          padding: '12px 16px',
                          fontWeight: 900,
                          textDecoration: 'none',
                          boxShadow: 'none',
                          maxWidth: '100%',
                          textAlign: 'center'
                        }}
                      >
                        Public QR Sayfasini Ac
                      </a>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      justifyItems: 'center',
                      gap: 12,
                      padding: 18,
                      borderRadius: 28,
                      background: 'color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 88%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--theme-accent) 12%, var(--app-border))',
                      boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--app-text) 6%, transparent)'
                    }}
                  >
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`${branchCard.name} QR Code`}
                        style={{
                          width: isCompact ? 'min(220px, 100%)' : 220,
                          height: isCompact ? 'auto' : 220,
                          aspectRatio: '1 / 1',
                          borderRadius: 28,
                          border: '1px solid color-mix(in srgb, var(--theme-accent) 14%, var(--app-border))',
                          background: '#ffffff',
                          padding: 14,
                          boxShadow: '0 16px 30px color-mix(in srgb, #000 10%, transparent)'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: isCompact ? 'min(220px, 100%)' : 220,
                          height: isCompact ? 'auto' : 220,
                          minHeight: 220,
                          aspectRatio: '1 / 1',
                          borderRadius: 28,
                          border: '1px solid color-mix(in srgb, var(--theme-accent) 14%, var(--app-border))',
                          display: 'grid',
                          placeItems: 'center',
                          background: '#ffffff',
                          color: '#64748b',
                          fontWeight: 800
                        }}
                      >
                        QR hazirlaniyor...
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--app-text-secondary)', fontWeight: 700, textAlign: 'center', maxWidth: 240 }}>
                      {branchCard.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
