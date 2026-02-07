import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function SignIn({ portal }) {
  const { login } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const portalName = portal === 'kermes' ? 'Restoran' : 'Giriş'

  useEffect(() => { document.title = `PenPOS – ${portalName} Giriş` }, [portalName])

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login({ identifier, password, portal })

      if (portal === 'kermes') {
        nav('/kermes', { replace: true })
      } else {
        nav('/', { replace: true })
      }
    } catch (err) {
      const code = err?.code || null
      if (code === 'invalid_credentials') setError('E-posta/şifre hatalı')
      else if (code === 'account_disabled') setError('Hesap devre dışı')
      else if (code === 'wrong_portal') setError('Yanlış giriş ekranı')
      else setError(err.message || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form className="card" style={{ width: 360 }} onSubmit={onSubmit}>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
            <Link to="/" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Geri Dön</Link>
            <h3 style={{ marginTop: 10, marginBottom: 4 }}>{portalName} Girişi</h3>
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
