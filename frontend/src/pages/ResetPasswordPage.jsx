import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { api } from '../lib/apiClient.js'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useBodyLayoutMode('public-site-layout')

  const token = String(params.get('token') || '').trim()

  useEffect(() => {
    document.title = 'PenPOS - Şifreyi Yenile'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError('Şifre sıfırlama bağlantısı eksik veya geçersiz.')
      return
    }
    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifreler birbiriyle eşleşmiyor.')
      return
    }

    setLoading(true)
    try {
      const res = await api('/api/auth/reset-password', {
        method: 'POST',
        data: { token, newPassword },
        silent: true,
        suppressAuthRedirect: true,
        portalOverride: 'restaurant',
      })
      if (!res?.ok) throw new Error(res?.message || 'Şifre güncellenemedi')
      setSuccess(res.message || 'Şifreniz başarıyla güncellendi.')
      const nextPath = String(res.loginPath || '/login/restoran')
      window.setTimeout(() => {
        nav(nextPath, { replace: true })
      }, 1600)
    } catch (err) {
      setError(err.message || 'Şifre güncellenemedi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="public-auth-page">
      <form className="card card--stable public-platform-login" onSubmit={onSubmit}>
        <Link to="/login" className="muted-link">← Giriş ekranına dön</Link>
        <h3 style={{ marginTop: 10, marginBottom: 6 }}>Yeni Şifre Belirle</h3>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
          Yeni şifrenizi belirleyin. Şifreniz en az 6 karakter olmalıdır.
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Şifre</div>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="yeni şifreniz"
              autoFocus
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Şifre Tekrar</div>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="şifrenizi tekrar girin"
            />
          </label>
          {error ? <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div> : null}
          {success ? <div style={{ color: '#047857', fontSize: 13 }}>{success}</div> : null}
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
          </button>
          {!token ? <div style={{ color: '#dc2626', fontSize: 12 }}>Geçerli bir sıfırlama bağlantısı açmanız gerekiyor.</div> : null}
        </div>
      </form>
    </div>
  )
}
