import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useAuth } from '../context/AuthContext.jsx'
import { SettingsCard, SettingsField, SettingsUiStyles } from '../components/settings/SettingsUi.jsx'
import { useTheme } from '../theme/ThemeContext.jsx'
import { themeKeys, themes } from '../theme/themeConfig.js'

const normalizeUsername = (value) => String(value || '').trim().toLowerCase()
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/

export default function SettingsMePage({ apiBase }) {
  const { refresh } = useAuth()
  const { themeKey, darkMode, setThemeKey, setDarkMode } = useTheme()
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [emailPw, setEmailPw] = useState('')
  const [username, setUsername] = useState('')
  const [usernamePw, setUsernamePw] = useState('')
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwNext2, setPwNext2] = useState('')
  const [saving, setSaving] = useState(false)
  const [platformThemeId, setPlatformThemeId] = useState(themeKey)
  const [platformDarkMode, setPlatformDarkMode] = useState(darkMode)

  const isPlatformMode = apiBase === '/api/platform'

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`${apiBase}/me`, { silent: true, skipBranchHeader: true })
      if (!res?.ok || res?.success === false) {
        setMe(null)
        return
      }
      const user = res?.user || null
      setMe(user)
      setEmail(String(user?.email || ''))
      setUsername(String(user?.username || ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setPlatformThemeId(themeKey)
    setPlatformDarkMode(darkMode)
  }, [darkMode, themeKey])

  const usernameHint = useMemo(() => {
    const next = normalizeUsername(username)
    if (!next) return ''
    if (USERNAME_RE.test(next)) return ''
    return 'Kullanıcı adı 3-24 karakter olmalı ve yalnızca a-z, 0-9, nokta, alt çizgi veya tire içermeli.'
  }, [username])

  const saveEmail = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await api(`${apiBase}/me/email`, {
        method: 'PUT',
        data: { email, currentPassword: emailPw },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_email') toast.error('Bu e-posta zaten kayıtlı')
        else if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı')
        else toast.error(res?.message || 'Güncellenemedi')
        return
      }
      toast.success('E-posta güncellendi')
      setEmailPw('')
      await refresh()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const saveUsername = async (event) => {
    event.preventDefault()
    const next = normalizeUsername(username)
    if (!next || !USERNAME_RE.test(next)) {
      toast.error('Geçersiz kullanıcı adı')
      return
    }
    setSaving(true)
    try {
      const res = await api(`${apiBase}/me/username`, {
        method: 'PUT',
        data: { username: next, currentPassword: usernamePw },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_username') toast.error('Bu kullanıcı adı zaten kayıtlı')
        else if (code === 'invalid_credentials') toast.error('Mevcut şifre hatalı')
        else toast.error(res?.message || 'Güncellenemedi')
        return
      }
      toast.success('Kullanıcı adı güncellendi')
      setUsernamePw('')
      await refresh()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
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
      const res = await api(`${apiBase}/me/password`, {
        method: 'PUT',
        data: { currentPassword: pwCurrent, newPassword: pwNext },
        silent: true,
        skipBranchHeader: true,
      })
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

  const savePlatformTheme = async (event) => {
    event.preventDefault()
    setThemeKey(platformThemeId)
    setDarkMode(platformDarkMode)
    toast.success('Platform tema tercihleri kaydedildi')
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 920 }}>
      <SettingsUiStyles />
      <h3 style={{ marginTop: 0 }}>Hesabım</h3>
      {loading && <div className="settings-ui-table-shell" style={{ padding: 18 }}>Yükleniyor...</div>}
      {!loading && !me && <div className="settings-ui-table-shell" style={{ padding: 18 }}>Kullanıcı bilgisi alınamadı</div>}
      {!loading && me ? (
        <>
          <SettingsCard title="Giriş Bilgileri" description="Kullanıcı adı ve e-posta değişikliklerini güvenli şekilde yönetin." icon="👤">
            <div style={{ display: 'grid', gap: 18 }}>
              <form onSubmit={saveUsername} style={{ display: 'grid', gap: 12 }}>
                <SettingsField label="Kullanıcı Adı">
                  <input className="settings-ui-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ornek: platformadmin" />
                </SettingsField>
                <div style={{ fontSize: 12, color: '#64748b' }}>Giriş için kullanılabilir.</div>
                {usernameHint ? <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>{usernameHint}</div> : null}
                <SettingsField label="Mevcut Şifre">
                  <input className="settings-ui-input" type="password" value={usernamePw} onChange={(e) => setUsernamePw(e.target.value)} />
                </SettingsField>
                <button className="settings-ui-submit" disabled={saving}>Kullanıcı Adını Güncelle</button>
              </form>

              <form onSubmit={saveEmail} style={{ display: 'grid', gap: 12 }}>
                <SettingsField label="E-posta">
                  <input className="settings-ui-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </SettingsField>
                <SettingsField label="Mevcut Şifre">
                  <input className="settings-ui-input" type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
                </SettingsField>
                <button className="settings-ui-submit" disabled={saving}>E-postayı Kaydet</button>
              </form>
            </div>
          </SettingsCard>

          <SettingsCard title="Şifre Değiştir" description="Mevcut şifrenizi doğrulayıp yeni şifre tanımlayın." icon="🔐">
            <form onSubmit={savePassword} style={{ display: 'grid', gap: 12 }}>
              <SettingsField label="Mevcut Şifre">
                <input className="settings-ui-input" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
              </SettingsField>
              <SettingsField label="Yeni Şifre">
                <input className="settings-ui-input" type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} />
              </SettingsField>
              <SettingsField label="Yeni Şifre (Tekrar)">
                <input className="settings-ui-input" type="password" value={pwNext2} onChange={(e) => setPwNext2(e.target.value)} />
              </SettingsField>
              <button className="settings-ui-submit" disabled={saving}>Şifreyi Güncelle</button>
            </form>
          </SettingsCard>

          {isPlatformMode ? (
            <SettingsCard title="Tema Tercihleri" description="Platform paneli için tema ve koyu mod tercihlerini ayrı kaydedin." icon="🎨">
              <form onSubmit={savePlatformTheme} style={{ display: 'grid', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, border: '1px solid var(--app-border)', borderRadius: 18 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 800 }}>Koyu mod</div>
                    <div style={{ fontSize: 13, color: 'var(--app-text-secondary)' }}>Platform paneli koyu yüzeylerle gösterilir.</div>
                  </div>
                  <input type="checkbox" checked={platformDarkMode} onChange={(e) => setPlatformDarkMode(e.target.checked)} />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  {themeKeys.map((key) => {
                    const item = themes[key]
                    const selected = platformThemeId === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPlatformThemeId(key)}
                        style={{
                          borderRadius: 22,
                          border: `1px solid ${selected ? 'var(--theme-accent, #0f172a)' : 'var(--app-border)'}`,
                          background: selected ? 'var(--app-surface-soft)' : 'var(--app-surface)',
                          padding: 14,
                          textAlign: 'left',
                          color: 'var(--app-text)',
                        }}
                      >
                        <div style={{ height: 42, borderRadius: 16, background: item.gradient }} />
                        <div style={{ marginTop: 10, fontWeight: 900 }}>{item.name}</div>
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="settings-ui-submit" disabled={saving}>Tema Tercihlerini Kaydet</button>
                </div>
              </form>
            </SettingsCard>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
