import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { setAuthToken } from '../lib/authStorage.js'
import { defaultWebsiteSettings } from '../constants/websiteSettings.js'
import { toast } from '../lib/toast.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const initialType = String(searchParams.get('type') || '').trim().toLowerCase() === 'market' ? 'market' : 'restaurant'
  const [settings, setSettings] = useState(defaultWebsiteSettings)
  const [form, setForm] = useState({
    businessType: initialType,
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Üye Ol'
  }, [])

  useEffect(() => {
    setForm((current) => ({ ...current, businessType: initialType }))
  }, [initialType])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const res = await api('/api/website-settings/public', {
        silent: true,
        skipBranchHeader: true,
        cacheTtlMs: 10000
      })
      if (!cancelled && res?.ok && res?.settings) {
        setSettings({ ...defaultWebsiteSettings, ...res.settings })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const systemType = form.businessType === 'market' ? 'canteen' : 'restaurant'
    const payload = {
      systemType,
      businessType: form.businessType,
      businessName: form.businessName,
      ownerName: form.ownerName,
      phone: form.phone,
      email: form.email,
      password: form.password,
      notes: form.notes
    }

    const res = await api('/api/public/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipBranchHeader: true,
      silent: true,
      suppressAuthRedirect: true
    })

    setLoading(false)

    if (!res?.ok || !res?.token) {
      const message = res?.message || 'Üyelik oluşturulamadı.'
      setError(message)
      toast.error(message)
      return
    }

    try {
      if (res.portal === 'canteen') setAuthToken('token_canteen', res.token, true)
      else setAuthToken('token_restaurant', res.token, true)
    } catch {}

    toast.success('Üyelik oluşturuldu. Deneme süresi başlatıldı.')
    window.location.href = res.redirectTo || (res.portal === 'canteen' ? '/canteen' : '/kermes')
  }

  return (
    <div className="public-auth-page public-auth-page--website register-page">
      <div className="public-auth-shell public-auth-shell--website register-shell">
        <div className="public-auth-head">
          <Link to="/" className="muted-link">← Ana sayfaya dön</Link>
          <h1>PenPOS üyeliği oluştur</h1>
          <p>Kayıt tamamlanınca sistem otomatik açılır ve 7 günlük deneme hemen başlar.</p>
        </div>

        <form className="card card--stable register-form" onSubmit={onSubmit}>
          <div className="register-type-grid">
            <button
              type="button"
              className={`register-type-card ${form.businessType === 'restaurant' ? 'is-active' : ''}`}
              onClick={() => setForm({ ...form, businessType: 'restaurant' })}
            >
              <span>🍽</span>
              <strong>Restoran / Cafe</strong>
              <p>Masa, adisyon, paket servis ve QR menü akışı.</p>
            </button>

            <button
              type="button"
              className={`register-type-card ${form.businessType === 'market' ? 'is-active' : ''}`}
              onClick={() => setForm({ ...form, businessType: 'market' })}
            >
              <span>🏪</span>
              <strong>Mağaza / Market</strong>
              <p>Barkodlu satış, stok, cari ve hızlı kasa akışı.</p>
            </button>
          </div>

          <div className="register-form-grid">
            <label>
              <div>İşletme Adı</div>
              <input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
            </label>

            <label>
              <div>Yetkili Ad Soyad</div>
              <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
            </label>

            <label>
              <div>Telefon</div>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </label>

            <label>
              <div>E-posta</div>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>

            <label>
              <div>Şifre</div>
              <input className="input" type="password" minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </label>

            <label className="register-full">
              <div>Kısa Not</div>
              <textarea
                className="input"
                rows="3"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Şube sayısı, yazıcı ihtiyacı, kurulum beklentisi..."
              />
            </label>
          </div>

          {error ? <div style={{ color: '#fca5a5', marginTop: 10 }}>{error}</div> : null}

          <div className="register-actions">
            <button className="marketing-btn marketing-btn--primary" type="submit" disabled={loading}>
              {loading ? 'Kayıt açılıyor...' : 'Üyeliği Oluştur ve Sistemi Aç'}
            </button>
            <Link
              className="marketing-btn marketing-btn--ghost"
              to={form.businessType === 'market' ? settings.canteenLoginUrl || settings.marketLoginUrl || '/canteen/login' : settings.restaurantLoginUrl || '/login/restoran'}
            >
              Mevcut Hesabım Var
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
