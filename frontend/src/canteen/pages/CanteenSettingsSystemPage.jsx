import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { useBusinessSettings } from '../../context/BusinessSettingsContext.jsx'
import { useTheme } from '../../theme/ThemeContext.jsx'
import ThemeSelectionCards from '../../components/settings/ThemeSelectionCards.jsx'
import { normalizeThemeId } from '../../theme/themeConfig.js'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const buildAppearanceSnapshot = (appearance) => ({
  themeId: normalizeThemeId(appearance?.themeId || 'white'),
  darkMode: appearance?.darkMode === true,
})

const normalizeBranchIdsList = (branchIds) => (
  Array.isArray(branchIds)
    ? branchIds.map(String).filter(Boolean).sort()
    : []
)

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

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    if (!background) setSuccess('')

    const [settingsRes, branchesRes] = await Promise.all([
      api('/api/canteen/settings', { silent: true }),
      api('/api/canteen/branches', { silent: true }),
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
    setBranches(Array.isArray(branchesRes?.branches) ? branchesRes.branches : [])
    const nextAllowedBranchIds = normalizeBranchIdsList(settingsRes?.settings?.allowedBranchIds)
    setAllowedBranchIds(nextAllowedBranchIds)
    setSavedAllowedBranchIds(nextAllowedBranchIds)

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
    const saved = await update({ appearance: currentAppearance })
    setSavingTheme(false)
    if (!saved?.ok) {
      revertThemePreview()
      return
    }
    setSuccess('Gorunum modu kaydedildi')
  }

  const saveSystemSettings = async () => {
    const nextAllowed = normalizeBranchIdsList(allowedBranchIds)
    if (nextAllowed.length === 0) return
    const patch = {
      allowedBranchIds: nextAllowed,
      ...(themeDirty ? { appearance: currentAppearance } : {}),
    }
    const saved = await update(patch)
    if (!saved?.ok) return
    setSuccess(themeDirty ? 'Gorunum modu ve sube ayarlari kaydedildi' : 'Sube ayarlari kaydedildi')
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
            <div style={{ marginTop: 8, maxWidth: 760, color: 'var(--app-text-secondary)', fontWeight: 700, lineHeight: 1.6, fontSize: isMobilePortrait ? 12.5 : 14 }}>
              Tema, koyu mod, yetkili subeler ve temel fis ayarlarini restoran paneline yakin bir duzenle yonetin.
            </div>
          </div>
          <button className="btn" type="button" onClick={load} disabled={loading || savingTheme}>
            {loading ? 'Yukleniyor...' : 'Yenile'}
          </button>
        </div>
      </div>

      {!!error && <div className="card" style={{ borderColor: 'color-mix(in srgb, #ef4444 35%, var(--app-border))', background: 'color-mix(in srgb, #ef4444 10%, var(--app-surface))', color: 'var(--app-text)' }}>{error}</div>}
      {!!success && <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 30%, var(--app-border))', background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--app-surface))', color: 'var(--app-text)' }}>{success}</div>}

      {Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0 && (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, #f59e0b 35%, var(--app-border))', background: 'color-mix(in srgb, #f59e0b 10%, var(--app-surface))', color: 'var(--app-text)' }}>
          Henuz yetkili sube secilmedi. Kaydetmeniz gerekiyor.
        </div>
      )}

      <div style={{ display: 'grid', minWidth: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>Temel Sistem Bilgileri</div>
          <label style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Varsayilan KDV</div>
            <input
              className="input"
              value={String(settings.defaultVatRate ?? 0)}
              onChange={(event) => setSettings((current) => ({ ...current, defaultVatRate: event.target.value }))}
              onBlur={() => update({ defaultVatRate: Number(settings.defaultVatRate || 0) })}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fis Ust Metin</div>
            <input
              className="input"
              value={String(settings.receiptHeader || '')}
              onChange={(event) => setSettings((current) => ({ ...current, receiptHeader: event.target.value }))}
              onBlur={() => update({ receiptHeader: settings.receiptHeader })}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fis Alt Metin</div>
            <input
              className="input"
              value={String(settings.receiptFooter || '')}
              onChange={(event) => setSettings((current) => ({ ...current, receiptFooter: event.target.value }))}
              onBlur={() => update({ receiptFooter: settings.receiptFooter })}
            />
          </label>
        </div>

        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>Gorunum Modu</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700 }}>
            Bu paneli beyaz mod veya koyu mod olarak kullanin.
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
            <button
              className="btn"
              type="button"
              disabled={!isAdmin || loading || savingTheme || !themeDirty}
              onClick={revertThemePreview}
            >
              Vazgec
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!isAdmin || loading || savingTheme || !themeDirty}
              onClick={saveThemeSettings}
            >
              {savingTheme ? 'Kaydediliyor...' : 'Gorunumu Kaydet'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>Yetkili Subeler</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700 }}>Bu panel icin erisilebilecek subeleri secin.</div>
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
            disabled={!isAdmin || loading || (!branchesDirty && !themeDirty) || !Array.isArray(allowedBranchIds) || allowedBranchIds.length === 0}
            onClick={saveSystemSettings}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
