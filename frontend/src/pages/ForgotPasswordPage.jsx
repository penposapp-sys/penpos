import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { api } from '../lib/apiClient.js'

const resolvePortalMeta = (portal) => {
  const normalized = String(portal || '').trim().toLowerCase()
  if (normalized === 'canteen' || normalized === 'kantin') {
    return {
      portal: 'canteen',
      title: 'Mağaza Şifre Sıfırlama',
      subtitle: 'Mağaza veya market hesabınız için sıfırlama bağlantısı gönderelim.',
      backTo: '/canteen/login',
    }
  }
  if (normalized === 'platform') {
    return {
      portal: 'platform',
      title: 'Platform Şifre Sıfırlama',
      subtitle: 'Platform yönetimi hesabınız için sıfırlama bağlantısı gönderelim.',
      backTo: '/platform-login',
    }
  }
  return {
    portal: 'restaurant',
    title: 'Şifremi Unuttum',
    subtitle: 'Restoran hesabınız için şifre sıfırlama bağlantısı gönderelim.',
    backTo: '/login/restoran',
  }
}

export default function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useBodyLayoutMode('public-site-layout')

  const meta = useMemo(() => resolvePortalMeta(params.get('portal')), [params])

  useEffect(() => {
    document.title = 'PenPOS - Şifremi Unuttum'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api('/api/auth/forgot-password', {
        method: 'POST',
        data: { email, portal: meta.portal },
        silent: true,
        suppressAuthRedirect: true,
        portalOverride: meta.portal === 'platform' ? 'platform' : (meta.portal === 'canteen' ? 'canteen' : 'restaurant'),
      })
      if (!res?.ok) throw new Error(res?.message || 'İşlem başarısız')
      setSuccess(res.message || 'Eğer bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.')
    } catch (err) {
      setError(err.message || 'İşlem başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="public-auth-page">
      <form className="card card--stable public-platform-login" onSubmit={onSubmit}>
        <Link to={meta.backTo} className="muted-link">← Giriş ekranına dön</Link>
        <h3 style={{ marginTop: 10, marginBottom: 6 }}>{meta.title}</h3>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>{meta.subtitle}</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="eposta@ornek.com"
              autoFocus
            />
          </label>
          {error ? <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div> : null}
          {success ? <div style={{ color: '#047857', fontSize: 13 }}>{success}</div> : null}
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Şifre sıfırlama bağlantısı 15 dakika boyunca geçerlidir.
          </div>
        </div>
      </form>
    </div>
  )
}
