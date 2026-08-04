import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import { useBusinessSettings } from '../../context/BusinessSettingsContext.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import ThemeSelectionCards from '../../components/settings/ThemeSelectionCards.jsx'
import { normalizeThemeId } from '../../theme/themeConfig.js'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const USERNAME_RE = /^[a-z0-9._-]{3,24}$/

const buildAppearanceSnapshot = (appearance) => ({
  themeId: normalizeThemeId(appearance?.themeId || 'white'),
  darkMode: appearance?.darkMode === true,
})

const normalizeBranchIdsList = (branchIds) => (
  Array.isArray(branchIds)
    ? branchIds.map(String).filter(Boolean).sort()
    : []
)

const normalizeUsername = (value) => String(value || '').trim().toLowerCase()

export default function CanteenSettingsSystemPage() {
  const { me } = useOutletContext()
  const { setSettingsLocally } = useBusinessSettings()
  const { setThemeKey, setDarkMode, theme, isMobileRuntime } = useTheme()
  const { isMobilePortrait } = useResponsiveFlags()
  const isAdmin = me?.role === 'tenant_admin'

  const [loading, setLoading] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [settings, setSettings] = useState(null)
  const [branches, setBranches] = useState([])
  const [allowedBranchIds, setAllowedBranchIds] = useState([])
  const [savedAllowedBranchIds, setSavedAllowedBranchIds] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savedAppearance, setSavedAppearance] = useState({ themeId: 'white', darkMode: false })

  const [account, setAccount] = useState(null)
  const [accountSaving, setAccountSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [emailPw, setEmailPw] = useState('')
  const [username, setUsername] = useState('')
  const [usernamePw, setUsernamePw] = useState('')
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwNext2, setPwNext2] = useState('')

  const [openCreate, setOpenCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [openEdit, setOpenEdit] = useState(false)
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [branchSaving, setBranchSaving] = useState(false)

  const shellTheme = isMobileRuntime
    ? {
        pageBg: 'var(--app-surface)',
        border: 'var(--app-border, var(--border))',
        shadow: 'none',
      }
    : {
        pageBg: 'var(--app-bg)',
        border: theme.border,
        shadow: 'none',
      }

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) {
      setLoading(true)
      setError('')
      setSuccess('')
    }

    try {
      const [settingsRes, branchesRes, meRes] = await Promise.all([
        api('/api/canteen/settings', { silent: true }),
        api('/api/canteen/branches', { silent: true, skipBranchHeader: true }),
        api('/api/canteen/me', { silent: true, skipBranchHeader: true }),
      ])

      const nextAppearance = buildAppearanceSnapshot(settingsRes?.settings?.appearance)
      setSettings({
        ...(settingsRes?.settings || null),
        appearance: nextAppearance,
      })
      setSettingsLocally({ appearance: nextAppearance })
      setSavedAppearance(nextAppearance)
      setThemeKey(nextAppearance.themeId)
      setDarkMode(nextAppearance.darkMode)

      const nextBranches = Array.isArray(branchesRes?.branches) ? branchesRes.branches : []
      setBranches(nextBranches)

      const nextAllowedBranchIds = normalizeBranchIdsList(settingsRes?.settings?.allowedBranchIds)
      setAllowedBranchIds(nextAllowedBranchIds)
      setSavedAllowedBranchIds(nextAllowedBranchIds)

      const nextAccount = meRes?.user || null
      setAccount(nextAccount)
      setEmail(String(nextAccount?.email || ''))
      setUsername(String(nextAccount?.username || ''))
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateSettings = async (patch) => {
    setLoading(true)
    setError('')
    setSuccess('')
    const res = await api('/api/canteen/settings', { method: 'PUT', data: patch, silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Guncellenemedi')
      setLoading(false)
      return res
    }

    const nextAppearance = buildAppearanceSnapshot(res?.settings?.appearance)
    setSettings({
      ...(res.settings || null),
      appearance: nextAppearance,
    })
    setSettingsLocally({ appearance: nextAppearance })
    setSavedAppearance(nextAppearance)
    if (Array.isArray(res?.settings?.allowedBranchIds)) {
      const nextAllowedBranchIds = normalizeBranchIdsList(res.settings.allowedBranchIds)
      setAllowedBranchIds(nextAllowedBranchIds)
      setSavedAllowedBranchIds(nextAllowedBranchIds)
    }
    setLoading(false)
    return res
  }

  const activeBranches = useMemo(() => branches.filter((branch) => branch.isActive !== false), [branches])
  const allowedSet = useMemo(() => new Set((allowedBranchIds || []).map(String)), [allowedBranchIds])
  const currentAppearance = buildAppearanceSnapshot(settings?.appearance)
  const darkModeEnabled = settings?.appearance?.darkMode === true
  const themeDirty = currentAppearance.themeId !== savedAppearance.themeId || currentAppearance.darkMode !== savedAppearance.darkMode
  const branchesDirty = normalizeBranchIdsList(allowedBranchIds).join(',') !== savedAllowedBranchIds.join(',')
  const usernameHint = useMemo(() => {
    const value = normalizeUsername(username)
    if (!value || USERNAME_RE.test(value)) return ''
    return 'Kullanici adi 3-24 karakter olmali ve yalnizca a-z, 0-9, nokta, alt cizgi veya tire icerebilir.'
  }, [username])

  const revertThemePreview = () => {
    setSettings((current) => ({
      ...(current || {}),
      appearance: buildAppearanceSnapshot(savedAppearance),
    }))
    setSettingsLocally({ appearance: buildAppearanceSnapshot(savedAppearance) })
    setThemeKey(normalizeThemeId(savedAppearance.themeId))
    setDarkMode(savedAppearance.darkMode)
  }

  const saveThemeSettings = async () => {
    setSavingTheme(true)
    setError('')
    setSuccess('')
    const saved = await updateSettings({ appearance: currentAppearance })
    setSavingTheme(false)
    if (!saved?.ok) {
      revertThemePreview()
      return
    }
    setSuccess('Gorunum modu kaydedildi')
  }

  const saveSystemSettings = async () => {
    const nextAllowed = normalizeBranchIdsList(allowedBranchIds)
    if (nextAllowed.length === 0) {
      setError('En az bir yetkili sube secmeniz gerekiyor.')
      return
    }
    const patch = {
      allowedBranchIds: nextAllowed,
      ...(themeDirty ? { appearance: currentAppearance } : {}),
    }
    const saved = await updateSettings(patch)
    if (!saved?.ok) return
    setSuccess(themeDirty ? 'Gorunum ve sube ayarlari kaydedildi' : 'Sube ayarlari kaydedildi')
  }

  const saveEmail = async (event) => {
    event.preventDefault()
    setAccountSaving(true)
    try {
      const res = await api('/api/canteen/me/email', {
        method: 'PUT',
        data: { email, currentPassword: emailPw },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_email') toast.error('Bu e-posta zaten kayitli.')
        else if (code === 'invalid_credentials') toast.error('Mevcut sifre hatali.')
        else toast.error(res?.message || 'E-posta guncellenemedi.')
        return
      }
      toast.success('E-posta guncellendi.')
      setEmailPw('')
      await load({ background: true })
    } finally {
      setAccountSaving(false)
    }
  }

  const saveUsername = async (event) => {
    event.preventDefault()
    const value = normalizeUsername(username)
    if (!value || !USERNAME_RE.test(value)) {
      toast.error('Gecerli bir kullanici adi girin.')
      return
    }
    setAccountSaving(true)
    try {
      const res = await api('/api/canteen/me/username', {
        method: 'PUT',
        data: { username: value, currentPassword: usernamePw },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_username') toast.error('Bu kullanici adi zaten kayitli.')
        else if (code === 'invalid_credentials') toast.error('Mevcut sifre hatali.')
        else toast.error(res?.message || 'Kullanici adi guncellenemedi.')
        return
      }
      toast.success('Kullanici adi guncellendi.')
      setUsernamePw('')
      await load({ background: true })
    } finally {
      setAccountSaving(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    if (!pwNext || pwNext.length < 8) {
      toast.error('Yeni sifre en az 8 karakter olmali.')
      return
    }
    if (pwNext !== pwNext2) {
      toast.error('Yeni sifre alanlari birbiriyle ayni degil.')
      return
    }
    setAccountSaving(true)
    try {
      const res = await api('/api/canteen/me/password', {
        method: 'PUT',
        data: { currentPassword: pwCurrent, newPassword: pwNext },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'invalid_credentials') toast.error('Mevcut sifre hatali.')
        else toast.error(res?.message || 'Sifre guncellenemedi.')
        return
      }
      toast.success('Sifre guncellendi.')
      setPwCurrent('')
      setPwNext('')
      setPwNext2('')
    } finally {
      setAccountSaving(false)
    }
  }

  const openEditModal = (branch) => {
    setEditId(String(branch?.id || ''))
    setEditName(String(branch?.name || ''))
    setEditDescription(String(branch?.description || ''))
    setOpenEdit(true)
  }

  const submitCreate = async () => {
    const name = String(createName || '').trim()
    if (!name) return
    setBranchSaving(true)
    setError('')
    try {
      const res = await api('/api/canteen/branches', {
        method: 'POST',
        data: { name, description: String(createDescription || '').trim() },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        setError(res?.message || 'Sube eklenemedi.')
        return
      }
      setOpenCreate(false)
      setCreateName('')
      setCreateDescription('')
      setSuccess('Yeni sube olusturuldu.')
      await load({ background: true })
    } finally {
      setBranchSaving(false)
    }
  }

  const submitEdit = async () => {
    if (!editId) return
    const name = String(editName || '').trim()
    if (!name) return
    setBranchSaving(true)
    setError('')
    try {
      const res = await api(`/api/canteen/branches/${editId}`, {
        method: 'PUT',
        data: { name, description: String(editDescription || '').trim() },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        setError(res?.message || 'Sube guncellenemedi.')
        return
      }
      setOpenEdit(false)
      setSuccess('Sube guncellendi.')
      await load({ background: true })
    } finally {
      setBranchSaving(false)
    }
  }

  const toggleBranchStatus = async (branch) => {
    const id = String(branch?.id || '')
    if (!id) return
    const nextActive = branch?.isActive === false
    const confirmed = window.confirm(nextActive ? 'Subeyi aktiflestirmek istiyor musunuz?' : 'Subeyi pasiflestirmek istiyor musunuz?')
    if (!confirmed) return
    setBranchSaving(true)
    setError('')
    try {
      const res = await api(`/api/canteen/branches/${id}/status`, {
        method: 'PUT',
        data: { isActive: nextActive },
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        setError(res?.message || 'Sube durumu guncellenemedi.')
        return
      }
      setSuccess(nextActive ? 'Sube aktif edildi.' : 'Sube pasiflestirildi.')
      await load({ background: true })
    } finally {
      setBranchSaving(false)
    }
  }

  const removeBranch = async (branch) => {
    const id = String(branch?.id || '')
    if (!id) return
    const confirmed = window.confirm(`"${branch?.name || 'Bu subeyi'}" silmek istiyor musunuz?`)
    if (!confirmed) return
    setBranchSaving(true)
    setError('')
    try {
      const res = await api(`/api/canteen/branches/${id}`, {
        method: 'DELETE',
        silent: true,
        skipBranchHeader: true,
      })
      if (!res?.ok) {
        setError(res?.message || 'Sube silinemedi.')
        return
      }
      setAllowedBranchIds((current) => (Array.isArray(current) ? current.filter((item) => String(item) !== id) : []))
      setSavedAllowedBranchIds((current) => (Array.isArray(current) ? current.filter((item) => String(item) !== id) : []))
      setSuccess('Sube silindi.')
      await load({ background: true })
    } finally {
      setBranchSaving(false)
    }
  }

  if (!settings) return <div className="card">Yukleniyor...</div>

  return (
    <div className="canteen-settings-system-page" style={{ display: 'grid', gap: 16 }}>
      <style>{`
        .canteen-settings-system-page .card {
          background: linear-gradient(180deg, var(--app-surface), var(--app-surface-soft, var(--panelElevated))) !important;
          color: var(--app-text) !important;
        }
        .canteen-settings-system-page .input,
        .canteen-settings-system-page input,
        .canteen-settings-system-page textarea,
        .canteen-settings-system-page select {
          background: var(--app-surface) !important;
          color: var(--app-text) !important;
          border-color: var(--app-border, var(--border)) !important;
        }
        .canteen-settings-system-page [style*='var(--muted)'] {
          color: var(--app-text-secondary, var(--muted)) !important;
        }
        .canteen-settings-system-page button:not(.theme-selection-card) {
          color: var(--settings-button-text, #ffffff) !important;
        }
        .canteen-system-layout {
          display: grid;
          grid-template-columns: minmax(280px, 0.9fr) minmax(320px, 1fr) minmax(360px, 1.2fr);
          gap: 16px;
          align-items: start;
        }
        .canteen-system-column {
          display: grid;
          gap: 16px;
          min-width: 0;
        }
        .canteen-system-card {
          display: grid;
          gap: 14px;
          padding: 18px;
          border-radius: 24px;
          border: 1px solid var(--app-border, var(--border));
        }
        .canteen-system-card h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
          line-height: 1.15;
        }
        .canteen-system-card p {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
          color: var(--app-text-secondary);
          font-weight: 700;
        }
        .canteen-system-stack {
          display: grid;
          gap: 12px;
        }
        .canteen-system-inline-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .canteen-branch-row {
          display: grid;
          gap: 10px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid var(--app-border, var(--border));
          background: color-mix(in srgb, var(--app-surface) 94%, transparent);
        }
        .canteen-branch-row-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .canteen-branch-row-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .canteen-branch-status-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 40px;
          padding: 0;
          border: 0;
          background: transparent !important;
          color: var(--app-text) !important;
          cursor: pointer;
        }
        .canteen-branch-status-toggle:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .canteen-branch-status-toggle-track {
          position: relative;
          width: 54px;
          height: 30px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--app-border, var(--border)) 82%, transparent);
          background: #d1d5db;
          transition: background-color 0.2s ease, border-color 0.2s ease;
          flex-shrink: 0;
        }
        .canteen-branch-status-toggle-track::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22);
          transition: transform 0.2s ease;
        }
        .canteen-branch-status-toggle.is-active .canteen-branch-status-toggle-track {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-color: #16a34a;
        }
        .canteen-branch-status-toggle.is-active .canteen-branch-status-toggle-track::after {
          transform: translateX(24px);
        }
        .canteen-branch-status-toggle:not(.is-active) .canteen-branch-status-toggle-track {
          background: linear-gradient(135deg, #f87171, #dc2626);
          border-color: #dc2626;
        }
        .canteen-branch-status-toggle-label {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.01em;
        }
        .canteen-branch-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .canteen-branch-pill {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
          background: var(--theme-accent-soft);
          color: var(--theme-accent-text);
        }
        @media (max-width: 1380px) {
          .canteen-system-layout {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .canteen-system-column.is-branches {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 820px) {
          .canteen-system-layout,
          .canteen-system-inline-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div
        className="card"
        style={{
          borderRadius: 28,
          border: `1px solid ${shellTheme.border}`,
          background: shellTheme.pageBg,
          boxShadow: shellTheme.shadow,
          padding: isMobilePortrait ? 18 : 22,
          display: 'grid',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: isMobilePortrait ? 22 : 30, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.03em', color: 'var(--app-text)' }}>Sistem Ayarlari</div>
            <div style={{ marginTop: 8, maxWidth: 860, color: 'var(--app-text-secondary)', fontWeight: 700, lineHeight: 1.6, fontSize: isMobilePortrait ? 12.5 : 14 }}>
              Hesap bilgileri, gorunum secimleri ve sube yonetimini tek ekranda yatay kolonlarla yonetin. Yetkili sube secimi, yeni sube olusturma, duzenleme, aktif-pasif ve silme islemleri artik bu sayfada.
            </div>
          </div>
          <button className="btn" type="button" onClick={() => load()} disabled={loading || savingTheme || accountSaving || branchSaving}>
            {loading ? 'Yukleniyor...' : 'Yenile'}
          </button>
        </div>
      </div>

      {!!error && <div className="card" style={{ borderColor: 'color-mix(in srgb, #ef4444 35%, var(--app-border))', background: 'color-mix(in srgb, #ef4444 10%, var(--app-surface))', color: 'var(--app-text)' }}>{error}</div>}
      {!!success && <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 30%, var(--app-border))', background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--app-surface))', color: 'var(--app-text)' }}>{success}</div>}

      <div className="canteen-system-layout">
        <div className="canteen-system-column">
          <div className="card canteen-system-card">
            <div>
              <h3>Hesap Ayarlari</h3>
              <p>Kullanici adi, e-posta ve sifre alanlarini tek kolonda daha kompakt yonetin.</p>
            </div>

            <div className="canteen-system-stack">
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800 }}>Rol</div>
                <div style={{ fontWeight: 900 }}>{String(account?.role || '-').replaceAll('_', ' ')}</div>
              </div>

              <form onSubmit={saveUsername} className="canteen-system-stack">
                <div style={{ fontWeight: 900 }}>Kullanici Adi</div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanici adi</div>
                  <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ornek: magaza1" />
                </label>
                {usernameHint ? <div style={{ fontSize: 12, color: '#b91c1c' }}>{usernameHint}</div> : null}
                <label style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut sifre</div>
                  <input className="input" type="password" value={usernamePw} onChange={(event) => setUsernamePw(event.target.value)} />
                </label>
                <button className="btn btn--primary" disabled={accountSaving}>Kullanici adini kaydet</button>
              </form>

              <form onSubmit={saveEmail} className="canteen-system-stack">
                <div style={{ fontWeight: 900 }}>E-posta</div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta adresi</div>
                  <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut sifre</div>
                  <input className="input" type="password" value={emailPw} onChange={(event) => setEmailPw(event.target.value)} />
                </label>
                <button className="btn btn--primary" disabled={accountSaving}>E-postayi kaydet</button>
              </form>

              <form onSubmit={savePassword} className="canteen-system-stack">
                <div style={{ fontWeight: 900 }}>Sifre Degistir</div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mevcut sifre</div>
                  <input className="input" type="password" value={pwCurrent} onChange={(event) => setPwCurrent(event.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni sifre</div>
                  <input className="input" type="password" value={pwNext} onChange={(event) => setPwNext(event.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni sifre tekrar</div>
                  <input className="input" type="password" value={pwNext2} onChange={(event) => setPwNext2(event.target.value)} />
                </label>
                <button className="btn btn--primary" disabled={accountSaving}>Sifreyi guncelle</button>
              </form>
            </div>
          </div>
        </div>

        <div className="canteen-system-column">
          <div className="card canteen-system-card">
            <div>
              <h3>Temel Sistem Bilgileri</h3>
              <p>Fis ve genel satis alanlari bu kolonda kalir.</p>
            </div>
            <div className="canteen-system-inline-grid">
              <label style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Varsayilan KDV</div>
                <input
                  className="input"
                  value={String(settings.defaultVatRate ?? 0)}
                  onChange={(event) => setSettings((current) => ({ ...current, defaultVatRate: event.target.value }))}
                  onBlur={() => updateSettings({ defaultVatRate: Number(settings.defaultVatRate || 0) })}
                />
              </label>
              <div />
              <label style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fis ust metin</div>
                <input
                  className="input"
                  value={String(settings.receiptHeader || '')}
                  onChange={(event) => setSettings((current) => ({ ...current, receiptHeader: event.target.value }))}
                  onBlur={() => updateSettings({ receiptHeader: settings.receiptHeader })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fis alt metin</div>
                <input
                  className="input"
                  value={String(settings.receiptFooter || '')}
                  onChange={(event) => setSettings((current) => ({ ...current, receiptFooter: event.target.value }))}
                  onBlur={() => updateSettings({ receiptFooter: settings.receiptFooter })}
                />
              </label>
            </div>
          </div>

          <div className="card canteen-system-card">
            <div>
              <h3>Gorunum Modu</h3>
              <p>Bu paneli beyaz mod veya koyu mod olarak kullanin.</p>
            </div>

            <ThemeSelectionCards
              darkMode={darkModeEnabled}
              onToggleDarkMode={(nextDarkMode) => {
                const nextAppearance = {
                  ...buildAppearanceSnapshot(settings?.appearance),
                  darkMode: Boolean(nextDarkMode),
                }
                setSettings((current) => ({
                  ...current,
                  appearance: nextAppearance,
                }))
                setSettingsLocally({ appearance: nextAppearance })
                setDarkMode(Boolean(nextDarkMode))
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" type="button" disabled={!isAdmin || loading || savingTheme || !themeDirty} onClick={revertThemePreview}>
                Vazgec
              </button>
              <button className="btn btn--primary" type="button" disabled={!isAdmin || loading || savingTheme || !themeDirty} onClick={saveThemeSettings}>
                {savingTheme ? 'Kaydediliyor...' : 'Gorunumu Kaydet'}
              </button>
            </div>
          </div>
        </div>

        <div className="canteen-system-column is-branches">
          <div className="card canteen-system-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h3>Yetkili Subeler ve Sube Yonetimi</h3>
                <p>Sistem erisimi, yeni sube olusturma ve aktif-pasif-duzenle-sil islemleri bu sutunda toplanir.</p>
              </div>
              <button className="btn btn--primary" type="button" onClick={() => setOpenCreate(true)} disabled={!isAdmin || branchSaving}>
                + Yeni Sube
              </button>
            </div>

            {Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0 ? (
              <div style={{ borderRadius: 16, padding: 12, border: '1px solid color-mix(in srgb, #f59e0b 35%, var(--app-border))', background: 'color-mix(in srgb, #f59e0b 10%, var(--app-surface))', fontWeight: 700 }}>
                Henuz yetkili sube secilmedi. En az bir sube secip kaydetmeniz gerekiyor.
              </div>
            ) : null}

            <div className="canteen-system-stack">
              {branches.map((branch) => {
                const id = String(branch.id)
                const checked = allowedSet.has(id)
                return (
                  <div key={id} className="canteen-branch-row">
                    <div className="canteen-branch-row-head">
                      <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isAdmin || loading || branchSaving}
                          onChange={() => {
                            setAllowedBranchIds((current) => {
                              const next = new Set(Array.isArray(current) ? current.map(String) : [])
                              if (next.has(id)) next.delete(id)
                              else next.add(id)
                              return Array.from(next)
                            })
                          }}
                        />
                        <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                          <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>{branch.name}</div>
                          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                            {String(branch.description || '').trim() || 'Bu sube icin aciklama girilmedi.'}
                          </div>
                        </div>
                      </label>

                      <div className="canteen-branch-pills">
                        <span className="canteen-branch-pill">
                          {branch.isActive === false ? 'Pasif' : 'Aktif'}
                        </span>
                        {checked ? <span className="canteen-branch-pill">Yetkili</span> : null}
                      </div>
                    </div>

                    <div className="canteen-branch-row-actions">
                      <button className="btn" type="button" onClick={() => openEditModal(branch)} disabled={!isAdmin || branchSaving}>Duzenle</button>
                      <button
                        type="button"
                        className={`canteen-branch-status-toggle${branch.isActive === false ? '' : ' is-active'}`}
                        onClick={() => toggleBranchStatus(branch)}
                        disabled={!isAdmin || branchSaving}
                        aria-pressed={branch.isActive !== false}
                        aria-label={branch.isActive === false ? 'Subeyi aktiflestir' : 'Subeyi pasiflestir'}
                      >
                        <span className="canteen-branch-status-toggle-track" aria-hidden="true" />
                        <span className="canteen-branch-status-toggle-label">
                          {branch.isActive === false ? 'Pasif' : 'Aktif'}
                        </span>
                      </button>
                      <button className="btn btn--danger" type="button" onClick={() => removeBranch(branch)} disabled={!isAdmin || branchSaving}>Sil</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn--primary"
                type="button"
                disabled={!isAdmin || loading || branchSaving || (!branchesDirty && !themeDirty) || !Array.isArray(allowedBranchIds) || allowedBranchIds.length === 0}
                onClick={saveSystemSettings}
              >
                Sube Secimlerini Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Yeni Sube Olustur">
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sube adi</div>
            <input className="input" value={createName} onChange={(event) => setCreateName(event.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aciklama</div>
            <input className="input" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" type="button" onClick={() => setOpenCreate(false)}>Vazgec</button>
            <button className="btn btn--primary" type="button" onClick={submitCreate} disabled={!String(createName || '').trim() || branchSaving}>Kaydet</button>
          </div>
        </div>
      </Modal>

      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Sube Duzenle">
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sube adi</div>
            <input className="input" value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aciklama</div>
            <input className="input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" type="button" onClick={() => setOpenEdit(false)}>Vazgec</button>
            <button className="btn btn--primary" type="button" onClick={submitEdit} disabled={!String(editName || '').trim() || branchSaving}>Kaydet</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
