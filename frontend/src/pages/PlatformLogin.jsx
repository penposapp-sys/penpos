import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { toast } from '../lib/toast.js'

export default function PlatformLogin() {
  const { login, logout } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { document.title = 'PenPOS – Platform Yönetimi Girişi' }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login({ identifier, password, portal: 'platform' })
      console.log('[PLATFORM_LOGIN_RES]', res)
      if (res?.role !== 'platform_admin') {
        logout()
        setError('Bu giriş yalnızca Platform Yöneticisi içindir.')
        toast.error('Bu giriş yalnızca Platform Yöneticisi içindir.')
        return
      }
      nav('/platform/kermes-tenants', { replace: true })
    } catch (err) {
      const msg = err?.code === 'invalid_credentials' ? 'E-posta veya şifre hatalı' : (err?.message || 'Giriş başarısız')
      setError(msg)
      toast.error(msg)
      return
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form className="card" style={{ width: 360 }} onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Platform Yöneticisi Girişi</h3>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Bu alan yalnızca sistem yöneticileri içindir.</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta / Kullanıcı adı</div>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="text" placeholder="e-posta veya kullanıcı adı" className="input" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="şifre" className="input" />
          </label>
          {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Gönderiliyor...' : 'Giriş Yap'}</button>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            <span>Restoran girişi için </span>
            <Link to="/login/restoran" className="muted-link">buraya tıklayın</Link>
          </div>
        </div>
      </form>
    </div>
  )
}
