import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './apiClient.js'

const normalizeId = (v) => String(v || '').trim()

export const useKitchenMenuFilters = ({ scope }) => {
  const safeScope = scope === 'kitchen_bulk' ? 'kitchen_bulk' : 'kitchen_normal'

  const [menuCategories, setMenuCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [hiddenMenuItemIds, setHiddenMenuItemIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const saveTimerRef = useRef(null)

  const hiddenSet = useMemo(() => new Set((Array.isArray(hiddenMenuItemIds) ? hiddenMenuItemIds : []).map(normalizeId).filter(Boolean)), [hiddenMenuItemIds])

  const loadAll = async () => {
    setError('')
    setLoading(true)
    try {
      const [menuRes, prefRes] = await Promise.all([
        api('/api/settings/menu/active-items', { silent: true }),
        api(`/api/user/preferences/kitchen-filters?scope=${encodeURIComponent(safeScope)}`, { silent: true })
      ])

      setMenuCategories(Array.isArray(menuRes?.categories) ? menuRes.categories : [])
      setMenuItems(Array.isArray(menuRes?.menuItems) ? menuRes.menuItems : [])
      setHiddenMenuItemIds(Array.isArray(prefRes?.hiddenMenuItemIds) ? prefRes.hiddenMenuItemIds.map(String) : [])
    } catch (e) {
      setError(e?.message || 'Yükleme hatası')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [safeScope])

  const persist = (nextHidden) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api('/api/user/preferences/kitchen-filters', {
          method: 'PUT',
          body: JSON.stringify({ scope: safeScope, hiddenMenuItemIds: nextHidden })
        })
      } catch {
      }
    }, 250)
  }

  const setHiddenAndPersist = (next) => {
    const normalized = (Array.isArray(next) ? next : []).map(normalizeId).filter(Boolean)
    setHiddenMenuItemIds(normalized)
    persist(normalized)
  }

  const toggleMenuItem = (menuItemId) => {
    const id = normalizeId(menuItemId)
    if (!id) return
    const next = new Set(hiddenSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHiddenAndPersist(Array.from(next))
  }

  const resetAllVisible = () => {
    setHiddenAndPersist([])
  }

  return {
    scope: safeScope,
    loading,
    error,
    reload: loadAll,
    menuCategories,
    menuItems,
    hiddenMenuItemIds,
    hiddenSet,
    toggleMenuItem,
    setHiddenMenuItemIds: setHiddenAndPersist,
    resetAllVisible
  }
}

