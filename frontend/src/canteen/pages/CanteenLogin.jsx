import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'

export default function CanteenLogin() {
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { document.title = 'PenPOS – Kantin Girişi' }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        data: { identifier, password, portal: 'canteen' },
        silent: true,
        suppressAuthRedirect: true,
        portalOverride: 'canteen'
      })
      if (!loginRes?.ok || !loginRes?.token) {
        throw new Error(loginRes?.message || 'Giriş başarısız')
      }
      localStorage.setItem('token_canteen', loginRes.token)
      nav('/canteen', { replace: true })
    } catch (err) {
      setError(err?.message || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form className="card" style={{ width: 360 }} onSubmit={onSubmit}>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <Link to="/" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Geri Dön</Link>
          <h3 style={{ marginTop: 10, marginBottom: 4 }}>Kantin Girişi</h3>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta / Kullanıcı adı</div>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="text" placeholder="e-posta veya kullanıcı adı" className="input" autoFocus />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="şifre" className="input" />
          </label>
          {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
          <button className="btn" disabled={loading}>{loading ? 'Gönderiliyor...' : 'Giriş Yap'}</button>
        </div>
      </form>
    </div>
  )
}
