import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'

const normalizeUsername = (v) => String(v || '').trim().toLowerCase()
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/

export default function CanteenSettingsMePage() {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [email, setEmail] = useState('')
  const [emailPw, setEmailPw] = useState('')
  const [username, setUsername] = useState('')
  const [usernamePw, setUsernamePw] = useState('')
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwNext2, setPwNext2] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/canteen/me', { silent: true, skipBranchHeader: true })
      if (!res?.ok || res?.success === false) {
        setMe(null)
        setLoading(false)
        return
      }
      const u = res?.user || null
      setMe(u)
      setEmail(String(u?.email || ''))
      setUsername(String(u?.username || ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const usernameHint = useMemo(() => {
    const t = normalizeUsername(username)
    if (!t) return ''
    if (USERNAME_RE.test(t)) return ''
    return 'Kullanıcı adı: 3-24 karakter, a-z0-9._-'
  }, [username])

  const saveEmail = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api('/api/canteen/me/email', { method: 'PUT', data: { email, currentPassword: emailPw }, silent: true, skipBranchHeader: true })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_email') toast.error('Bu e-posta zaten kayıtlı')
        else if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı')
        else toast.error(res?.message || 'Güncellenemedi')
        return
      }
      toast.success('E-posta güncellendi')
      setEmailPw('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const saveUsername = async (e) => {
    e.preventDefault()
    const t = normalizeUsername(username)
    if (!t || !USERNAME_RE.test(t)) {
      toast.error('Geçersiz kullanıcı adı')
      return
    }
    setSaving(true)
    try {
      const res = await api('/api/canteen/me/username', { method: 'PUT', data: { username: t, currentPassword: usernamePw }, silent: true, skipBranchHeader: true })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_username') toast.error('Bu kullanıcı adı zaten kayıtlı')
        else if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı')
        else toast.error(res?.message || 'Güncellenemedi')
        return
      }
      toast.success('Kullanıcı adı güncellendi')
      setUsernamePw('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (!pwNext || pwNext.length < 8) {
      toast.error('Yeni şifre en az 8 karakter olmalı')
      return
    }
    if (pwNext !== pwNext2) {
      toast.error('Yeni şifreler aynı değil')
      return
    }
    setSaving(true)
    try {
      const res = await api('/api/canteen/me/password', { method: 'PUT', data: { currentPassword: pwCurrent, newPassword: pwNext }, silent: true, skipBranchHeader: true })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı')
        else toast.error(res?.message || 'Güncellenemedi')
        return
      }
      toast.success('Şifre güncellendi')
      setPwCurrent('')
      setPwNext('')
      setPwNext2('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Hesabım</div>
      {loading && <div className="card">Yükleniyor...</div>}
      {!loading && !me && <div className="card">Kullanıcı bilgisi alınamadı</div>}
      {!loading && me && (
        <>
          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Giriş Bilgileri</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <form onSubmit={saveUsername} style={{ display: 'grid', gap: 10 }}>
                <label>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı Adı</div>
                  <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ornek: kantin1" />
                </label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Giriş için kullanılabilir</div>
                {usernameHint ? <div style={{ fontSize: 12, color: '#b91c1c' }}>{usernameHint}</div> : null}
                <label>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut Şifre</div>
                  <input className="input" type="password" value={usernamePw} onChange={(e) => setUsernamePw(e.target.value)} />
                </label>
                <button className="btn" disabled={saving}>Kullanıcı Adını Güncelle</button>
              </form>

              <form onSubmit={saveEmail} style={{ display: 'grid', gap: 10 }}>
                <label>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
                  <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut Şifre</div>
                  <input className="input" type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
                </label>
                <button className="btn" disabled={saving}>E-posta Kaydet</button>
              </form>
            </div>
          </div>

          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Şifre Değiştir</div>
            <form onSubmit={savePassword} style={{ display: 'grid', gap: 10 }}>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut Şifre</div>
                <input className="input" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Şifre</div>
                <input className="input" type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Şifre (Tekrar)</div>
                <input className="input" type="password" value={pwNext2} onChange={(e) => setPwNext2(e.target.value)} />
              </label>
              <button className="btn" disabled={saving}>Şifreyi Güncelle</button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
