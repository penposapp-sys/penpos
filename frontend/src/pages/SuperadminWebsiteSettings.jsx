import React, { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AdminPageHeader, AdminTableCard, formatAdminDate } from '../components/AdminListUi.jsx'
import { defaultWebsiteSettings } from '../constants/websiteSettings.js'
import { api } from '../lib/apiClient.js'

const sections = [
  { key: 'general', label: 'Genel', title: 'Genel Metinler' },
  { key: 'hero', label: 'Hero Alani', title: 'Ana Sayfa Hero Alani' },
  { key: 'content', label: 'Bolumler', title: 'Bolum Basliklari' },
  { key: 'features', label: 'Ozellikler', title: 'Ozellik Kartlari' },
  { key: 'pricing', label: 'Fiyat', title: 'Fiyat Kartlari' },
  { key: 'videos', label: 'Videolar', title: 'Egitim Videolari' },
  { key: 'login', label: 'Giris Linkleri', title: 'Giris Linkleri' },
  { key: 'android', label: 'Android', title: 'Android Uygulamasi' },
  { key: 'theme', label: 'Tema', title: 'Renk Ayarlari' },
  { key: 'footer', label: 'Footer', title: 'Footer / Iletisim' }
]

const openPreviewPage = () => {
  const path = '/landing'
  try {
    if (Capacitor.isNativePlatform()) {
      window.location.assign(path)
      return
    }
  } catch {}
  window.open(path, '_blank', 'noopener,noreferrer')
}

export default function SuperadminWebsiteSettings() {
  const [form, setForm] = useState(defaultWebsiteSettings)
  const [savedSettings, setSavedSettings] = useState(defaultWebsiteSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeSection, setActiveSection] = useState('hero')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/api/superadmin/website-settings')
      const next = { ...defaultWebsiteSettings, ...(res?.settings || {}) }
      setForm(next)
      setSavedSettings(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setListItemField = (listKey, index, key, value) => {
    setForm((current) => {
      const source = Array.isArray(current?.[listKey]) ? [...current[listKey]] : []
      while (source.length <= index) {
        if (listKey === 'features') source.push({ id: `${listKey}-${source.length + 1}`, icon: 'store', title: '', text: '', sortOrder: source.length + 1, active: true })
        else if (listKey === 'pricingPlans') source.push({ id: `${listKey}-${source.length + 1}`, name: '', price: '', period: '', description: '', items: [], popular: false, buttonText: '', buttonUrl: '', active: true, sortOrder: source.length + 1 })
        else if (listKey === 'trainingVideos') source.push({ id: `${listKey}-${source.length + 1}`, title: '', description: '', youtubeUrl: '', category: 'general', active: true, sortOrder: source.length + 1 })
      }
      source[index] = { ...(source[index] || {}), [key]: value }
      return { ...current, [listKey]: source }
    })
  }

  const hasChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedSettings), [form, savedSettings])

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await api('/api/superadmin/website-settings', {
        method: 'PUT',
        body: JSON.stringify(form)
      })
      const next = { ...defaultWebsiteSettings, ...(res?.settings || {}) }
      setForm(next)
      setSavedSettings(next)
      setMessage('Web site ayarlari kaydedildi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setForm(defaultWebsiteSettings)
    setError('')
    setMessage('Form varsayilan degerlere alindi. Kaydet ile yayinlayabilirsiniz.')
  }

  const renderInput = (label, key, options = {}) => {
    const isTextarea = options.multiline === true
    const value = form?.[key] ?? ''
    return (
      <label className={options.full ? 'website-settings-full' : ''}>
        <div className="website-settings-label">{label}</div>
        {isTextarea ? (
          <textarea
            className="input"
            rows={options.rows || 4}
            value={value}
            onChange={(event) => setField(key, event.target.value)}
            placeholder={options.placeholder || ''}
          />
        ) : (
          <input
            className="input"
            type={options.type || 'text'}
            value={value}
            onChange={(event) => setField(key, event.target.value)}
            placeholder={options.placeholder || ''}
          />
        )}
      </label>
    )
  }

  const renderColorInput = (label, key) => (
    <label>
      <div className="website-settings-label">{label}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="input"
          type="color"
          value={form?.[key] || '#000000'}
          onChange={(event) => setField(key, event.target.value)}
          style={{ width: 56, padding: 6 }}
        />
        <input
          className="input"
          type="text"
          value={form?.[key] || ''}
          onChange={(event) => setField(key, event.target.value)}
          placeholder="#000000"
        />
      </div>
    </label>
  )

  return (
    <div className="main website-settings-page-shell">
      <div className="admin-page website-settings-admin-page">
        <AdminPageHeader
          title="Web Site Ayarlari"
          subtitle="Ana web sitesi metinlerini, butonlarini ve bagli linklerini super admin panelinden yonetin."
          action={(
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={resetToDefaults}>Varsayilana Dondur</button>
              <button type="button" className="btn" onClick={openPreviewPage}>Onizle</button>
              <button type="button" className="btn btn--primary" disabled={saving || loading} onClick={save}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          )}
        />

        {error ? <div style={{ color: '#dc2626', fontWeight: 700 }}>{error}</div> : null}
        {message ? <div style={{ color: '#047857', fontWeight: 700 }}>{message}</div> : null}

        <div className="website-settings-layout">
          <AdminTableCard className="website-settings-nav-card">
            <div className="website-settings-tabs">
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={`btn website-settings-tab${activeSection === section.key ? ' btn--primary' : ''}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label}
                </button>
              ))}

              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                Son guncelleme: {savedSettings?.updatedAt ? formatAdminDate(savedSettings.updatedAt, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Henuz yok'}
              </div>
              {hasChanges ? <div style={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>Kaydedilmemis degisiklik var.</div> : null}
            </div>
          </AdminTableCard>

          <div className="website-settings-content-stack">
            {loading ? (
              <AdminTableCard>
                <div style={{ padding: 12, fontWeight: 700, color: '#64748b' }}>Yukleniyor...</div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'general' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'general')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Logo alt yazisi ve ust menu metinlerini bu alandan yonetin.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
                    {renderInput('Site basligi', 'siteTitle')}
                    {renderInput('Logo alt yazisi', 'brandSubtitle')}
                    {renderInput('Menu: Sistemler', 'headerSystemsLabel')}
                    {renderInput('Menu: Ozellikler', 'headerFeaturesLabel')}
                    {renderInput('Menu: Fiyat', 'headerPricingLabel')}
                    {renderInput('Menu: Egitim videolari', 'headerTrainingLabel')}
                    {renderInput('SEO basligi', 'seoTitle', { full: true })}
                    {renderInput('SEO aciklamasi', 'seoDescription', { multiline: true, rows: 3, full: true })}
                  </div>
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'hero' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'hero')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Ana sayfadaki ust metinler ve iki ana aksiyon butonu bu alandan yonetilir.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
                    {renderInput('Ana baslik', 'heroTitle', { full: true })}
                    {renderInput('Alt baslik', 'heroSubtitle', { full: true })}
                    {renderInput('Aciklama metni', 'heroDescription', { multiline: true, rows: 5, full: true })}
                    {renderInput('Madde 1', 'heroPointOne')}
                    {renderInput('Madde 2', 'heroPointTwo')}
                    {renderInput('Madde 3', 'heroPointThree')}
                    {renderInput('Ana buton yazisi', 'primaryCtaText')}
                    {renderInput('Ana buton linki', 'primaryCtaUrl', { placeholder: '/register veya https://...' })}
                    {renderInput('Ikinci buton yazisi', 'secondaryCtaText')}
                    {renderInput('Ikinci buton linki', 'secondaryCtaUrl', { placeholder: '/login/restoran veya https://...' })}
                  </div>
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'content' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'content')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Ana bolum basliklari ve aciklamalari bu ekrandan guncellenir.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
                    {renderInput('Sistemler ust baslik', 'systemsSectionEyebrow')}
                    {renderInput('Sistemler baslik', 'systemsSectionTitle', { full: true })}
                    {renderInput('Sistemler aciklama', 'systemsSectionText', { multiline: true, rows: 3, full: true })}
                    {renderInput('Operasyonlar ust baslik', 'operationsSectionEyebrow')}
                    {renderInput('Operasyonlar baslik', 'operationsSectionTitle', { full: true })}
                    {renderInput('Operasyonlar aciklama', 'operationsSectionText', { multiline: true, rows: 3, full: true })}
                    {renderInput('Fiyat ust baslik', 'pricingSectionEyebrow')}
                    {renderInput('Fiyat baslik', 'pricingSectionTitle', { full: true })}
                    {renderInput('Fiyat aciklama', 'pricingSectionText', { multiline: true, rows: 3, full: true })}
                    {renderInput('Video ust baslik', 'trainingSectionEyebrow')}
                    {renderInput('Video baslik', 'trainingSectionTitle', { full: true })}
                    {renderInput('Video aciklama', 'trainingSectionText', { multiline: true, rows: 3, full: true })}
                  </div>
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'features' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'features')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Ana sayfadaki ozellik kartlarinin baslik ve aciklamalarini duzenleyin.</p>
                  </div>
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="website-settings-grid" style={{ display: 'grid', marginBottom: 18, paddingBottom: 18, borderBottom: index < 2 ? '1px solid var(--line)' : '0' }}>
                      <label>
                        <div className="website-settings-label">{`Kart ${index + 1} ikon`}</div>
                        <input className="input" value={form.features?.[index]?.icon || ''} onChange={(event) => setListItemField('features', index, 'icon', event.target.value)} placeholder="store / cart / chart" />
                      </label>
                      <label>
                        <div className="website-settings-label">{`Kart ${index + 1} baslik`}</div>
                        <input className="input" value={form.features?.[index]?.title || ''} onChange={(event) => setListItemField('features', index, 'title', event.target.value)} />
                      </label>
                      <label className="website-settings-full">
                        <div className="website-settings-label">{`Kart ${index + 1} aciklama`}</div>
                        <textarea className="input" rows={3} value={form.features?.[index]?.text || ''} onChange={(event) => setListItemField('features', index, 'text', event.target.value)} />
                      </label>
                    </div>
                  ))}
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'pricing' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'pricing')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Fiyat kartlarinin buton, madde ve aciklamalari bu alandan yonetilir.</p>
                  </div>
                  {[0, 1].map((index) => (
                    <div key={index} className="website-settings-grid" style={{ display: 'grid', marginBottom: 18, paddingBottom: 18, borderBottom: index < 1 ? '1px solid var(--line)' : '0' }}>
                      <label>
                        <div className="website-settings-label">{`Paket ${index + 1} adi`}</div>
                        <input className="input" value={form.pricingPlans?.[index]?.name || ''} onChange={(event) => setListItemField('pricingPlans', index, 'name', event.target.value)} />
                      </label>
                      <label>
                        <div className="website-settings-label">{`Paket ${index + 1} fiyat`}</div>
                        <input className="input" value={form.pricingPlans?.[index]?.price || ''} onChange={(event) => setListItemField('pricingPlans', index, 'price', event.target.value)} />
                      </label>
                      <label className="website-settings-full">
                        <div className="website-settings-label">{`Paket ${index + 1} aciklama`}</div>
                        <textarea className="input" rows={3} value={form.pricingPlans?.[index]?.description || ''} onChange={(event) => setListItemField('pricingPlans', index, 'description', event.target.value)} />
                      </label>
                      <label>
                        <div className="website-settings-label">{`Paket ${index + 1} buton yazisi`}</div>
                        <input className="input" value={form.pricingPlans?.[index]?.buttonText || ''} onChange={(event) => setListItemField('pricingPlans', index, 'buttonText', event.target.value)} />
                      </label>
                      <label>
                        <div className="website-settings-label">{`Paket ${index + 1} buton linki`}</div>
                        <input className="input" value={form.pricingPlans?.[index]?.buttonUrl || ''} onChange={(event) => setListItemField('pricingPlans', index, 'buttonUrl', event.target.value)} />
                      </label>
                      <label className="website-settings-full">
                        <div className="website-settings-label">{`Paket ${index + 1} maddeler`}</div>
                        <textarea
                          className="input"
                          rows={4}
                          value={Array.isArray(form.pricingPlans?.[index]?.items) ? form.pricingPlans[index].items.join('\n') : ''}
                          onChange={(event) => setListItemField('pricingPlans', index, 'items', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
                          placeholder="Her satira bir madde"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'videos' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'videos')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Egitim video kartlarinin yazilarini ve linklerini duzenleyin.</p>
                  </div>
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="website-settings-grid" style={{ display: 'grid', marginBottom: 18, paddingBottom: 18, borderBottom: index < 2 ? '1px solid var(--line)' : '0' }}>
                      <label>
                        <div className="website-settings-label">{`Video ${index + 1} baslik`}</div>
                        <input className="input" value={form.trainingVideos?.[index]?.title || ''} onChange={(event) => setListItemField('trainingVideos', index, 'title', event.target.value)} />
                      </label>
                      <label>
                        <div className="website-settings-label">{`Video ${index + 1} link`}</div>
                        <input className="input" value={form.trainingVideos?.[index]?.youtubeUrl || ''} onChange={(event) => setListItemField('trainingVideos', index, 'youtubeUrl', event.target.value)} placeholder="https://youtube.com/..." />
                      </label>
                      <label className="website-settings-full">
                        <div className="website-settings-label">{`Video ${index + 1} aciklama`}</div>
                        <textarea className="input" rows={3} value={form.trainingVideos?.[index]?.description || ''} onChange={(event) => setListItemField('trainingVideos', index, 'description', event.target.value)} />
                      </label>
                    </div>
                  ))}
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'login' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'login')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Giris secim ekranindaki buton yazi ve linklerini duzenleyin.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
                    {renderInput('Restoran giris buton yazisi', 'restaurantLoginText')}
                    {renderInput('Restoran giris linki', 'restaurantLoginUrl', { placeholder: '/login/restoran' })}
                    {renderInput('Kantin giris buton yazisi', 'canteenLoginText')}
                    {renderInput('Kantin giris linki', 'canteenLoginUrl', { placeholder: '/canteen/login' })}
                  </div>
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'android' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'android')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Android indirme butonunu acip kapatin ve APK baglantisini guncelleyin.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
                    {renderInput('Android buton yazisi', 'androidButtonText')}
                    {renderInput('APK indirme linki', 'androidApkUrl', { placeholder: 'https://...' })}
                    <label className="website-settings-full">
                      <div className="website-settings-label">Buton durumu</div>
                      <label className="website-settings-toggle">
                        <input
                          type="checkbox"
                          checked={form.androidButtonActive === true}
                          onChange={(event) => setField('androidButtonActive', event.target.checked)}
                        />
                        Buton aktif
                      </label>
                    </label>
                  </div>
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'theme' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'theme')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Ana sayfa arka plan, vurgu ve footer renklerini hex formatinda yonetin.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
                    {renderColorInput('Arka plan baslangic', 'themeBackgroundStart')}
                    {renderColorInput('Arka plan bitis', 'themeBackgroundEnd')}
                    {renderColorInput('Header arka plan', 'themeHeaderBackground')}
                    {renderColorInput('Kart zemini', 'themeSurfaceColor')}
                    {renderColorInput('Vurgu rengi', 'themeAccentColor')}
                    {renderColorInput('Vurgu yazi rengi', 'themeAccentTextColor')}
                    {renderColorInput('Ana yazi rengi', 'themeTextColor')}
                    {renderColorInput('Yardimci yazi rengi', 'themeMutedTextColor')}
                    {renderColorInput('Cizgi / kenarlik', 'themeBorderColor')}
                    {renderColorInput('Footer arka plan', 'themeFooterBackground')}
                  </div>
                </div>
              </AdminTableCard>
            ) : null}

            {activeSection === 'footer' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'footer')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Footer metni, iletisim bilgileri ve sosyal medya linklerini duzenleyin.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
                    {renderInput('Iletisim basligi', 'contactSectionTitle')}
                    {renderInput('WhatsApp etiket', 'whatsappLabel')}
                    {renderInput('WhatsApp durum', 'whatsappStatusText')}
                    {renderInput('Footer yazisi', 'footerText', { multiline: true, rows: 3, full: true })}
                    {renderInput('E-posta', 'email', { type: 'email' })}
                    {renderInput('Telefon', 'phone')}
                    {renderInput('WhatsApp linki', 'whatsappUrl', { placeholder: 'https://wa.me/...' })}
                    {renderInput('Instagram linki', 'socialInstagramUrl', { placeholder: 'https://...' })}
                    {renderInput('Facebook linki', 'socialFacebookUrl', { placeholder: 'https://...' })}
                    {renderInput('X linki', 'socialXUrl', { placeholder: 'https://...' })}
                    {renderInput('YouTube linki', 'socialYoutubeUrl', { placeholder: 'https://...' })}
                    {renderInput('LinkedIn linki', 'socialLinkedinUrl', { placeholder: 'https://...' })}
                  </div>
                </div>
              </AdminTableCard>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
