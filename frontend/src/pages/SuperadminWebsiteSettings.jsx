import React, { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AdminPageHeader, AdminTableCard, formatAdminDate } from '../components/AdminListUi.jsx'
import { defaultWebsiteSettings } from '../constants/websiteSettings.js'
import { api } from '../lib/apiClient.js'

const sections = [
  { key: 'hero', label: 'Hero Alani', title: 'Ana Sayfa Hero Alani' },
  { key: 'login', label: 'Giris Linkleri', title: 'Giris Linkleri' },
  { key: 'android', label: 'Android', title: 'Android Uygulamasi' },
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

  return (
    <div className="main">
      <div className="admin-page">
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
          <AdminTableCard>
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

          <div style={{ display: 'grid', gap: 16 }}>
            {loading ? (
              <AdminTableCard>
                <div style={{ padding: 12, fontWeight: 700, color: '#64748b' }}>Yukleniyor...</div>
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
                    {renderInput('Ana buton yazisi', 'primaryCtaText')}
                    {renderInput('Ana buton linki', 'primaryCtaUrl', { placeholder: '/register veya https://...' })}
                    {renderInput('Ikinci buton yazisi', 'secondaryCtaText')}
                    {renderInput('Ikinci buton linki', 'secondaryCtaUrl', { placeholder: '/login/restoran veya https://...' })}
                  </div>
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
                    {renderInput('Platform giris buton yazisi', 'platformLoginText')}
                    {renderInput('Platform giris linki', 'platformLoginUrl', { placeholder: '/platform/login' })}
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

            {activeSection === 'footer' ? (
              <AdminTableCard>
                <div className="website-settings-panel">
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{sections.find((item) => item.key === 'footer')?.title}</h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>Footer metni, iletisim bilgileri ve sosyal medya linklerini duzenleyin.</p>
                  </div>
                  <div className="website-settings-grid" style={{ display: 'grid' }}>
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
