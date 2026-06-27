import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { mergeBusinessSettings } from '../lib/businessSettings.js'
import { getScopedDarkModeStorageKey, getScopedThemeStorageKey, normalizeThemeId, resolveThemeScope } from '../theme/themeConfig.js'
import { isMobileRuntime as detectMobileRuntime } from '../utils/device.js'
import { useAuth } from './AuthContext.jsx'
import { useTheme } from '../theme/ThemeContext.jsx'

const BusinessSettingsContext = createContext({
  settings: mergeBusinessSettings(),
  tenant: null,
  branches: [],
  loading: false,
  error: '',
  refresh: async () => null,
  setSettingsLocally: () => {},
  getSetting: () => undefined,
  hasSetting: () => false,
})

const readPath = (source, path) => {
  const parts = String(path || '').split('.').filter(Boolean)
  let current = source
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = current[part]
  }
  return current
}

const getCurrentPathname = () => {
  if (typeof window === 'undefined') return ''
  return String(window.location?.pathname || '')
}

const isCanteenSystemType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'canteen' || normalized === 'kantin'
}

const getInitialBusinessSettings = (scope = resolveThemeScope(getCurrentPathname())) => {
  if (detectMobileRuntime() || typeof window === 'undefined') {
    return mergeBusinessSettings()
  }

  try {
    const scopedThemeId = String(localStorage.getItem(getScopedThemeStorageKey(scope)) || '').trim()
    const themeId = normalizeThemeId(scopedThemeId || 'white')
    const scopedDarkMode = localStorage.getItem(getScopedDarkModeStorageKey(scope))
    const darkMode = scopedDarkMode === 'true'
    return mergeBusinessSettings({
      appearance: {
        themeId,
        darkMode,
      },
    })
  } catch {
    return mergeBusinessSettings()
  }
}

export function BusinessSettingsProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const { setThemeKey, setDarkMode, themeScope, isMobileRuntime } = useTheme()
  const [settings, setSettings] = useState(() => getInitialBusinessSettings())
  const [tenant, setTenant] = useState(null)
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canLoad = !!user?.tenantId && (user.role === 'tenant_admin' || user.role === 'staff')
  const isPublicScope = themeScope === 'public'
  const storageScope = useMemo(() => {
    if (user?.role === 'platform_admin' || user?.role === 'superadmin') return 'platform'
    if (isCanteenSystemType(user?.systemType)) return 'canteen'
    if (user?.tenantId) return 'kermes'
    return themeScope || resolveThemeScope(getCurrentPathname())
  }, [themeScope, user?.role, user?.systemType, user?.tenantId])

  const refresh = async () => {
    if (isPublicScope || !canLoad) {
      setSettings(getInitialBusinessSettings(storageScope))
      setTenant(null)
      setBranches([])
      setError('')
      return null
    }

    setLoading(true)
    setError('')
    try {
      if (isCanteenSystemType(user?.systemType)) {
        const settingsRes = await api('/api/canteen/settings', { silent: true, skipBranchHeader: true, portalOverride: 'canteen' })
        const merged = mergeBusinessSettings({
          appearance: {
            themeId: normalizeThemeId(settingsRes?.settings?.appearance?.themeId || 'white'),
            darkMode: settingsRes?.settings?.appearance?.darkMode === true,
          },
        })
        setSettings(merged)
        setTenant(null)
        setBranches([])
        return merged
      }

      const [settingsRes, branchesRes] = await Promise.all([
        api('/api/settings/business', { silent: true, skipBranchHeader: true }),
        api('/api/settings/business/branches', { silent: true, skipBranchHeader: true }),
      ])
      const merged = mergeBusinessSettings(settingsRes?.settings || {})
      setSettings(merged)
      setTenant(settingsRes?.tenant || null)
      setBranches(Array.isArray(branchesRes?.branches) ? branchesRes.branches : [])
      return merged
    } catch (err) {
      setError(err.message || 'İşletme ayarları yüklenemedi')
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    refresh()
  }, [authLoading, canLoad, isPublicScope, storageScope, user?.tenantId, user?.role, user?.systemType])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const body = document.body
    const publicDefaults = mergeBusinessSettings()
    const themeId = normalizeThemeId(settings?.appearance?.themeId || 'white')
    const darkMode = settings?.appearance?.darkMode === true
    const fontSize = String(settings?.appearance?.fontSize || 'medium')
    const animationsEnabled = settings?.appearance?.animationsEnabled !== false
    const colorfulProducts = settings?.appearance?.colorfulProducts === true
    const language = String(settings?.notifications?.language || 'tr').trim() || 'tr'

    if (isPublicScope) {
      root.dataset.businessLanguage = String(publicDefaults?.notifications?.language || 'tr')
      root.dataset.fontSize = String(publicDefaults?.appearance?.fontSize || 'medium')
      body?.classList.remove('tenant-font-small', 'tenant-font-medium', 'tenant-font-large')
      body?.classList.add(`tenant-font-${String(publicDefaults?.appearance?.fontSize || 'medium')}`)

      root.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products')
      body?.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products')

      setThemeKey('white')
      setDarkMode(false)

      return () => {
        root.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products')
        body?.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products', 'tenant-font-small', 'tenant-font-medium', 'tenant-font-large')
      }
    }

    root.dataset.businessLanguage = language
    root.dataset.fontSize = fontSize
    body?.classList.remove('tenant-font-small', 'tenant-font-medium', 'tenant-font-large')
    body?.classList.add(`tenant-font-${fontSize}`)

    root.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products')
    body?.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products')

    setThemeKey(themeId)
    setDarkMode(darkMode)
    try {
      localStorage.setItem(getScopedThemeStorageKey(storageScope), themeId)
      localStorage.setItem(getScopedDarkModeStorageKey(storageScope), String(darkMode))
    } catch {}

    if (isMobileRuntime) {
      return () => {
        body?.classList.remove(`tenant-font-${fontSize}`)
      }
    }

    root.classList.toggle('tenant-dark-mode', darkMode)
    root.classList.toggle('tenant-no-animations', !animationsEnabled)
    root.classList.toggle('tenant-colorful-products', colorfulProducts)

    body?.classList.toggle('tenant-dark-mode', darkMode)
    body?.classList.toggle('tenant-no-animations', !animationsEnabled)
    body?.classList.toggle('tenant-colorful-products', colorfulProducts)

    return () => {
      root.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products')
      body?.classList.remove('tenant-dark-mode', 'tenant-no-animations', 'tenant-colorful-products', `tenant-font-${fontSize}`)
    }
  }, [isMobileRuntime, isPublicScope, setDarkMode, setThemeKey, settings, storageScope])

  const value = useMemo(() => ({
    settings,
    tenant,
    branches,
    loading,
    error,
    refresh,
    setSettingsLocally: (nextSettings) => setSettings(mergeBusinessSettings(nextSettings)),
    getSetting: (path, fallback) => {
      const valueAtPath = readPath(settings, path)
      return valueAtPath === undefined ? fallback : valueAtPath
    },
    hasSetting: (path) => Boolean(readPath(settings, path)),
  }), [settings, tenant, branches, loading, error])

  return (
    <BusinessSettingsContext.Provider value={value}>
      {children}
    </BusinessSettingsContext.Provider>
  )
}

export const useBusinessSettings = () => useContext(BusinessSettingsContext)
