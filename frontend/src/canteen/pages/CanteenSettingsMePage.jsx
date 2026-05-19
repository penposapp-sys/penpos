import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import CanteenSettingsSection, { CanteenSettingsCard } from '../components/CanteenSettingsSection.jsx'

const normalizeUsername = (value) => String(value || '').trim().toLowerCase()
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

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    try {
      const res = await api('/api/canteen/me', { silent: true, skipBranchHeader: true })
      if (!res?.ok || res?.success === false) {
        setMe(null)
        return
      }
      const user = res?.user || null
      setMe(user)
      setEmail(String(user?.email || ''))
      setUsername(String(user?.username || ''))
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const usernameHint = useMemo(() => {
    const value = normalizeUsername(username)
    if (!value || USERNAME_RE.test(value)) return ''
    return 'Kullanıcı adı 3-24 karakter olmalı ve yalnızca a-z, 0-9, nokta, alt çizgi veya tire içerebilir.'
  }, [username])

  const saveEmail = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await api('/api/canteen/me/email', {
        method: 'PUT',
        data: { email, currentPassword: emailPw },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_email') toast.error('Bu e-posta zaten kayıtlı.')
        else if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı.')
        else toast.error(res?.message || 'E-posta güncellenemedi.')
        return
      }
      toast.success('E-posta güncellendi.')
      setEmailPw('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const saveUsername = async (event) => {
    event.preventDefault()
    const value = normalizeUsername(username)
    if (!value || !USERNAME_RE.test(value)) {
      toast.error('Geçerli bir kullanıcı adı girin.')
      return
    }
    setSaving(true)
    try {
      const res = await api('/api/canteen/me/username', {
        method: 'PUT',
        data: { username: value, currentPassword: usernamePw },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_username') toast.error('Bu kullanıcı adı zaten kayıtlı.')
        else if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı.')
        else toast.error(res?.message || 'Kullanıcı adı güncellenemedi.')
        return
      }
      toast.success('Kullanıcı adı güncellendi.')
      setUsernamePw('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    if (!pwNext || pwNext.length < 8) {
      toast.error('Yeni şifre en az 8 karakter olmalı.')
      return
    }
    if (pwNext !== pwNext2) {
      toast.error('Yeni şifre alanları birbiriyle aynı değil.')
      return
    }
    setSaving(true)
    try {
      const res = await api('/api/canteen/me/password', {
        method: 'PUT',
        data: { currentPassword: pwCurrent, newPassword: pwNext },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı.')
        else toast.error(res?.message || 'Şifre güncellenemedi.')
        return
      }
      toast.success('Şifre güncellendi.')
      setPwCurrent('')
      setPwNext('')
      setPwNext2('')
    } finally {
      setSaving(false)
    }
  }

  const stats = [
    { label: 'Rol', value: String(me?.role || '-').replaceAll('_', ' ') },
    { label: 'Kullanıcı', value: username || '-' },
    { label: 'E-posta', value: email || '-' },
  ]

  return (
    <CanteenSettingsSection
      badge="Hesap Yönetimi"
      title="Kişisel giriş ve güvenlik ayarları"
      description="Mağaza paneline giriş için kullanılan kullanıcı adı, e-posta ve şifre bilgilerinizi daha modern ve düzenli bir akışla yönetin."
      stats={me ? stats : []}
      actions={<button className="btn" type="button" onClick={load} disabled={loading || saving}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>}
    >
      {loading ? <CanteenSettingsCard style={{ padding: 18 }}>Yükleniyor...</CanteenSettingsCard> : null}
      {!loading && !me ? <CanteenSettingsCard style={{ padding: 18 }}>Kullanıcı bilgisi alınamadı.</CanteenSettingsCard> : null}

      {!loading && me ? (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <CanteenSettingsCard style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Kullanıcı Adı</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 14 }}>
              Giriş ekranında kullanacağınız kullanıcı adını doğrulayıp güncelleyin.
            </div>
            <form onSubmit={saveUsername} style={{ display: 'grid', gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı adı</div>
                <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ornek: magaza1" />
              </label>
              {usernameHint ? <div style={{ fontSize: 12, color: '#b91c1c' }}>{usernameHint}</div> : null}
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut şifre</div>
                <input className="input" type="password" value={usernamePw} onChange={(event) => setUsernamePw(event.target.value)} />
              </label>
              <button className="btn btn--primary" disabled={saving}>Kullanıcı adını kaydet</button>
            </form>
          </CanteenSettingsCard>

          <CanteenSettingsCard style={{ padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>E-posta</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 14 }}>
              Bildirim ve oturum kurtarma işlemleri için kullandığınız e-posta adresini güncelleyin.
            </div>
            <form onSubmit={saveEmail} style={{ display: 'grid', gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta adresi</div>
                <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut şifre</div>
                <input className="input" type="password" value={emailPw} onChange={(event) => setEmailPw(event.target.value)} />
              </label>
              <button className="btn btn--primary" disabled={saving}>E-postayı kaydet</button>
            </form>
          </CanteenSettingsCard>

          <CanteenSettingsCard style={{ padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Şifre Değiştir</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 14 }}>
              Hesabınızı daha güvenli tutmak için yeni bir şifre belirleyin.
            </div>
            <form onSubmit={savePassword} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut şifre</div>
                <input className="input" type="password" value={pwCurrent} onChange={(event) => setPwCurrent(event.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni şifre</div>
                <input className="input" type="password" value={pwNext} onChange={(event) => setPwNext(event.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni şifre tekrar</div>
                <input className="input" type="password" value={pwNext2} onChange={(event) => setPwNext2(event.target.value)} />
              </label>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button className="btn btn--primary" disabled={saving} style={{ width: '100%' }}>Şifreyi güncelle</button>
              </div>
            </form>
          </CanteenSettingsCard>
        </div>
      ) : null}
    </CanteenSettingsSection>
  )
}
