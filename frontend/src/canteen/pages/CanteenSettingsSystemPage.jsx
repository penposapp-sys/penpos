import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { useBusinessSettings } from '../../context/BusinessSettingsContext.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import { themeKeys, themes } from '../../theme/themeConfig.js'

const buildAppearanceSnapshot = (appearance) => ({
  themeId: String(appearance?.themeId || 'default'),
  darkMode: appearance?.darkMode === true
})

export default function CanteenSettingsSystemPage() {
  const { me } = useOutletContext()
  const { setSettingsLocally } = useBusinessSettings()
  const { setThemeKey, setDarkMode, theme, themeKey, darkMode } = useTheme()
  const isAdmin = me?.role === 'tenant_admin'
  const [loading, setLoading] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [settings, setSettings] = useState(null)
  const [branches, setBranches] = useState([])
  const [allowedBranchIds, setAllowedBranchIds] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savedAppearance, setSavedAppearance] = useState({ themeId: 'default', darkMode: false })

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    if (!background) setSuccess('')
    const [s, b] = await Promise.all([
      api('/api/canteen/settings', { silent: true }),
      api('/api/canteen/branches', { silent: true })
    ])

    const nextAppearance = buildAppearanceSnapshot(s?.settings?.appearance)
    setSettings({
      ...(s?.settings || null),
      appearance: nextAppearance
    })
    setSettingsLocally({ appearance: nextAppearance })
    setSavedAppearance(nextAppearance)
    setThemeKey(nextAppearance.themeId)
    setDarkMode(nextAppearance.darkMode)
    setBranches(Array.isArray(b?.branches) ? b.branches : [])
    setAllowedBranchIds(Array.isArray(s?.settings?.allowedBranchIds) ? s.settings.allowedBranchIds.map(String).filter(Boolean) : [])
    if (!background) setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const update = async (patch) => {
    setLoading(true)
    setError('')
    setSuccess('')
    const res = await api('/api/canteen/settings', { method: 'PUT', data: patch, silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Güncellenemedi')
      setLoading(false)
      return res
    }

    const nextAppearance = buildAppearanceSnapshot(res?.settings?.appearance)
    setSettings({
      ...(res.settings || null),
      appearance: nextAppearance
    })
    setSettingsLocally({ appearance: nextAppearance })
    setSavedAppearance(nextAppearance)
    if (Array.isArray(res?.settings?.allowedBranchIds)) {
      setAllowedBranchIds(res.settings.allowedBranchIds.map(String).filter(Boolean))
    }
    setLoading(false)
    return res
  }

  const activeBranches = useMemo(() => branches.filter((branch) => branch.isActive !== false), [branches])
  const allowedSet = useMemo(() => new Set((allowedBranchIds || []).map(String)), [allowedBranchIds])
  const selectedThemeId = String(settings?.appearance?.themeId || 'default')
  const darkModeEnabled = settings?.appearance?.darkMode === true
  const themeDirty = selectedThemeId !== savedAppearance.themeId || darkModeEnabled !== savedAppearance.darkMode

  const shellTheme = {
    pageBg: `radial-gradient(circle at top left, ${theme.accentSoft} 0, transparent 30%), radial-gradient(circle at bottom right, ${theme.border} 0, transparent 26%), var(--app-bg)`,
    border: theme.border,
    shadow: theme.activeGlow,
  }

  const revertThemePreview = () => {
    setSettings((current) => ({
      ...(current || {}),
      appearance: buildAppearanceSnapshot(savedAppearance)
    }))
    setSettingsLocally({ appearance: buildAppearanceSnapshot(savedAppearance) })
    setThemeKey(savedAppearance.themeId)
    setDarkMode(savedAppearance.darkMode)
  }

  const saveThemeSettings = async () => {
    setSavingTheme(true)
    setError('')
    setSuccess('')
    const nextAppearance = buildAppearanceSnapshot(settings?.appearance)
    const saved = await update({ appearance: nextAppearance })
    setSavingTheme(false)
    if (!saved?.ok) {
      revertThemePreview()
      return
    }
    setSuccess('Tema ayarları kaydedildi')
  }

  if (!settings) return <div className="card">Yükleniyor...</div>

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
        .canteen-settings-system-page button:not(.btn--primary) {
          color: var(--app-text) !important;
        }
      `}</style>
      <div
        className="card"
        style={{
          borderRadius: 28,
          border: `1px solid ${shellTheme.border}`,
          background: shellTheme.pageBg,
          boxShadow: shellTheme.shadow,
          padding: 22,
          display: 'grid',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: '-0.03em', color: 'var(--app-text)' }}>Sistem Ayarları</div>
            <div style={{ marginTop: 8, maxWidth: 760, color: 'var(--app-text-secondary)', fontWeight: 700, lineHeight: 1.6 }}>
              Tema, koyu mod, yetkili şubeler ve temel fiş ayarlarını restoran paneline yakın bir düzenle yönetin.
            </div>
          </div>
          <button className="btn" type="button" onClick={load} disabled={loading || savingTheme}>
            {loading ? 'Yükleniyor...' : 'Yenile'}
          </button>
        </div>
      </div>

      {!!error && <div className="card" style={{ borderColor: 'color-mix(in srgb, #ef4444 35%, var(--app-border))', background: 'color-mix(in srgb, #ef4444 10%, var(--app-surface))', color: 'var(--app-text)' }}>{error}</div>}
      {!!success && <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 30%, var(--app-border))', background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--app-surface))', color: 'var(--app-text)' }}>{success}</div>}

      {Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0 && (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, #f59e0b 35%, var(--app-border))', background: 'color-mix(in srgb, #f59e0b 10%, var(--app-surface))', color: 'var(--app-text)' }}>
          Henüz yetkili şube seçilmedi. Kaydetmeniz gerekiyor.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>Temel Sistem Bilgileri</div>
          <label style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Varsayılan KDV</div>
            <input
              className="input"
              value={String(settings.defaultVatRate ?? 0)}
              onChange={(event) => setSettings((current) => ({ ...current, defaultVatRate: event.target.value }))}
              onBlur={() => update({ defaultVatRate: Number(settings.defaultVatRate || 0) })}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Üst Metin</div>
            <input
              className="input"
              value={String(settings.receiptHeader || '')}
              onChange={(event) => setSettings((current) => ({ ...current, receiptHeader: event.target.value }))}
              onBlur={() => update({ receiptHeader: settings.receiptHeader })}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Alt Metin</div>
            <input
              className="input"
              value={String(settings.receiptFooter || '')}
              onChange={(event) => setSettings((current) => ({ ...current, receiptFooter: event.target.value }))}
              onBlur={() => update({ receiptFooter: settings.receiptFooter })}
            />
          </label>
        </div>

        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>Tema Seçenekleri</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700 }}>
            Tema kartına tıklayın, koyu modu değiştirin ve ardından kaydedin. Önizleme anında uygulanır.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 18 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontWeight: 800 }}>Koyu mod</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kartlar ve yüzeyler koyu renk paletiyle gösterilir.</div>
            </div>
            <button
              type="button"
              className="btn"
              disabled={!isAdmin || loading || savingTheme}
              onClick={() => {
                const nextDarkMode = !darkModeEnabled
                const nextAppearance = {
                  ...buildAppearanceSnapshot(settings?.appearance),
                  darkMode: nextDarkMode
                }
                setSettings((current) => ({
                  ...current,
                  appearance: nextAppearance
                }))
                setSettingsLocally({ appearance: nextAppearance })
                setDarkMode(nextDarkMode)
              }}
              style={{
                minWidth: 120,
                background: darkModeEnabled ? 'var(--theme-accent, #111827)' : 'var(--button-bg, #e5e7eb)',
                borderColor: darkModeEnabled ? 'var(--theme-accent, #111827)' : 'var(--button-border, #d1d5db)',
                color: darkModeEnabled ? '#ffffff' : 'var(--text)'
              }}
            >
              {darkModeEnabled ? 'Açık' : 'Kapalı'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {themeKeys.map((key) => {
              const item = themes[key]
              const selected = selectedThemeId === key

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isAdmin || loading || savingTheme}
                  onClick={() => {
                    const nextAppearance = {
                      ...buildAppearanceSnapshot(settings?.appearance),
                      themeId: key
                    }
                    setSettings((current) => ({
                      ...current,
                      appearance: nextAppearance
                    }))
                    setSettingsLocally({ appearance: nextAppearance })
                    setThemeKey(key)
                  }}
                  style={{
                    borderRadius: 24,
                    border: `1px solid ${selected ? 'var(--theme-accent, #0f172a)' : 'var(--border)'}`,
                    background: selected ? 'var(--panelElevated)' : 'var(--panel)',
                    color: 'var(--text)',
                    padding: 16,
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: selected ? 'var(--card-shadow)' : '0 10px 22px rgba(15, 23, 42, 0.05)'
                  }}
                >
                  <div style={{ height: 48, borderRadius: 18, background: item.gradient }} />
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 900 }}>{item.name}</div>
                    {selected ? <span style={{ borderRadius: 999, background: 'var(--theme-accent, #0f172a)', color: '#ffffff', padding: '4px 8px', fontSize: 11, fontWeight: 900 }}>Seçili</span> : null}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              type="button"
              disabled={!isAdmin || loading || savingTheme || !themeDirty}
              onClick={revertThemePreview}
            >
              Vazgeç
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!isAdmin || loading || savingTheme || !themeDirty}
              onClick={saveThemeSettings}
            >
              {savingTheme ? 'Kaydediliyor...' : 'Tema Ayarlarını Kaydet'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>Yetkili Şubeler</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700 }}>Bu panel için erişilebilecek şubeleri seçin.</div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {activeBranches.map((branch) => {
            const id = String(branch.id)
            const checked = allowedSet.has(id)
            return (
              <label key={id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isAdmin || loading}
                  onChange={() => {
                    setAllowedBranchIds((current) => {
                      const next = new Set(Array.isArray(current) ? current.map(String) : [])
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return Array.from(next)
                    })
                  }}
                />
                <div style={{ display: 'grid', gap: 2, flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{branch.name}</div>
                  {!!branch.description && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{branch.description}</div>}
                </div>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn btn--primary"
            type="button"
            disabled={!isAdmin || loading || !Array.isArray(allowedBranchIds) || allowedBranchIds.length === 0}
            onClick={async () => {
              const nextAllowed = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String).filter(Boolean) : []
              if (nextAllowed.length === 0) return
              const saved = await update({ allowedBranchIds: nextAllowed })
              if (!saved?.ok) return
              setSuccess('Şube ayarları kaydedildi')
            }}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
