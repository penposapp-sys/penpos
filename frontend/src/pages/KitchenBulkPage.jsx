import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import MenuItemFilterDrawer from '../components/MenuItemFilterDrawer.jsx'
import { useKitchenMenuFilters } from '../lib/useKitchenMenuFilters.js'
import { useKitchenAlertSound } from '../lib/useKitchenAlertSound.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function KitchenBulkPage() {
  const { allowedBranchIds } = useAuth()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const doneLocalRef = useRef(new Set())
  const lastRowKeysRef = useRef([])
  const initialLoadedRef = useRef(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const menuFilters = useKitchenMenuFilters({ scope: 'kitchen_bulk' })
  const { soundEnabled, setSoundEnabled, soundIcon, ensureAudioUnlocked, playAlert } = useKitchenAlertSound()

  const load = async () => {
    setError('')
    try {
      if (!Array.isArray(allowedBranchIds)) {
        setItems([])
        setCategories([])
        return
      }
      const { params } = buildBranchQueryParams(allowedBranchIds)
      if (!params) {
        setItems([])
        setCategories([])
        return
      }
      const res = await api(`/api/kitchen/bulk-items?${params.toString()}`, { skipBranchHeader: true, suppressBranchModal: true })
      const safeItems = Array.isArray(res?.items) ? res.items : []

      const doneSet = doneLocalRef.current
      const filtered = safeItems
        .map(it => ({
          ...it,
          rows: (Array.isArray(it?.rows) ? it.rows : []).filter(r => !doneSet.has(String(r?.rowKey || '')))
        }))
        .filter(it => (Array.isArray(it?.rows) ? it.rows : []).length > 0)

      setItems(filtered)

      const rowKeys = filtered
        .flatMap(it => (Array.isArray(it?.rows) ? it.rows : []).map(r => String(r?.rowKey || '')))
        .filter(Boolean)
      const prevRowKeys = lastRowKeysRef.current || []
      lastRowKeysRef.current = rowKeys

      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true
        return
      }

      const newRowKeys = rowKeys.filter(key => !prevRowKeys.includes(key))
      if (newRowKeys.length > 0) {
        await playAlert()
      }
    } catch (err) {
      setError(err?.message || 'Yükleme hatası')
    }
  }

  useEffect(() => {
    initialLoadedRef.current = false
    lastRowKeysRef.current = []
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [(Array.isArray(allowedBranchIds) ? allowedBranchIds : []).join(','), playAlert])

  const doneRow = async (rowKey, payload) => {
    const key = String(rowKey || '')
    if (!key) return

    doneLocalRef.current.add(key)

    setItems(prev => {
      const next = (Array.isArray(prev) ? prev : [])
        .map(card => {
          const rows = (Array.isArray(card?.rows) ? card.rows : []).filter(r => String(r?.rowKey || '') !== key)
          const totalQty = rows.reduce((sum, r) => sum + Math.max(1, Number(r?.qty || 1)), 0)
          return { ...card, rows, totalQty }
        })
        .filter(card => (Array.isArray(card?.rows) ? card.rows.length : 0) > 0)
      return next
    })

    try {
      await api(`/api/kitchen/bulk-items/${encodeURIComponent(key)}/done`, {
        method: 'POST',
        body: JSON.stringify(payload || {})
      })
    } catch (err) {
      doneLocalRef.current.delete(key)
      setError(err?.message || 'İşlem başarısız')
      await load()
    }
  }

  const setRowCooking = async (rowKey) => {
    const key = String(rowKey || '')
    if (!key) return
    const [orderId, itemId] = key.split(':')
    if (!orderId || !itemId) return
    try {
      await api(`/api/kitchen/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/cooking`, {
        method: 'PUT'
      })
      await load()
    } catch (err) {
      setError(err?.message || 'İşlem başarısız')
    }
  }

  const visibleItems = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    const hidden = menuFilters.hiddenSet
    return list.filter(it => {
      const id = String(it?.menuItemId || '').trim()
      if (!id) return true
      return !hidden.has(id)
    })
  }, [items, menuFilters.hiddenSet])

  const totalCards = useMemo(() => (Array.isArray(visibleItems) ? visibleItems.length : 0), [visibleItems])
  const waitingItems = useMemo(() => visibleItems.filter((card) => String(card?.status || '') === 'sent'), [visibleItems])
  const stoveItems = useMemo(() => visibleItems.filter((card) => String(card?.status || '') === 'cooking'), [visibleItems])

  const renderBulkCards = (list, actionMode) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {(Array.isArray(list) ? list : []).map(card => {
        const rows = Array.isArray(card?.rows) ? card.rows : []
        const isWeightBased = !!card?.isWeightBased
        const cardWeightGrams = Number(card?.weightGrams || 0) || 0
        return (
          <div key={`${String(card?.menuItemId || '')}|${String(cardWeightGrams || '')}|${String(card?.status || '')}`} className="card theme-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10, fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(card?.name || '-')}</div>
              <div style={{ whiteSpace: 'nowrap' }}>
                {isWeightBased ? `${cardWeightGrams} gr` : `x${Math.max(0, Number(card?.totalQty || 0))}`}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {rows.map(r => {
                const rowKey = String(r?.rowKey || '')
                const tableName = String(r?.tableName || '')
                const qty = Math.max(1, Number(r?.qty || 1))
                const rowIsWeightBased = !!r?.isWeightBased
                const weightGrams = Number(r?.weightGrams || 0) || 0
                const createdAt = r?.createdAt || null
                return (
                  <div
                    key={rowKey}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 10,
                      border: '1px solid var(--app-border, var(--border))',
                      borderRadius: 10,
                      padding: '10px 12px',
                      background: actionMode === 'cooking'
                        ? 'color-mix(in srgb, #2563eb 18%, var(--app-surface-2, var(--app-surface-soft)))'
                        : 'var(--app-surface-2, var(--app-surface-soft))',
                      color: 'var(--app-text)'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
                          {tableName || 'Sipariş'}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {rowIsWeightBased ? <span>{weightGrams} gr</span> : null}
                        {createdAt ? <span>Saat: {new Date(createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span> : null}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 52,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: 'color-mix(in srgb, #2563eb 18%, var(--app-surface))',
                          color: 'var(--app-text)',
                          border: '1px solid color-mix(in srgb, #2563eb 38%, var(--app-border))',
                          fontWeight: 800,
                          fontSize: 14
                        }}
                      >
                        x{qty}
                      </span>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          if (actionMode === 'waiting') {
                            setRowCooking(rowKey)
                            return
                          }
                          doneRow(rowKey, { tableName, qty, weightGrams, createdAt })
                        }}
                      >
                        {actionMode === 'waiting' ? 'OCAKTA' : 'HAZIRLA'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="main theme-page">
      <div className="theme-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, padding: 12, borderRadius: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>{'Toplu Ürün Hazırlama'}</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{`${totalCards} ürün`}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (next) {
                await ensureAudioUnlocked()
              }
            }}
            title={soundEnabled ? 'Ses Açık (Kapat)' : 'Ses Kapalı (Aç)'}
          >
            {soundIcon}
          </button>
          <button className="btn" onClick={() => setFilterOpen(true)} type="button">Filtre</button>
          <button className="btn" onClick={load} type="button">Yenile</button>
        </div>
      </div>

      {error && <div className="card theme-card" style={{ borderColor: '#ef4444', color: '#fca5a5', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : (isTablet ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))'), gap: 12, alignItems: 'start', minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="card theme-card-soft" style={{ fontWeight: 800 }}>Ocağa Atılmamış Urunler</div>
          {renderBulkCards(waitingItems, 'waiting')}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="card theme-card-soft" style={{ fontWeight: 800 }}>Ocaktaki Urunler</div>
          {renderBulkCards(stoveItems, 'cooking')}
        </div>
      </div>

      <MenuItemFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        categories={menuFilters.menuCategories}
        menuItems={menuFilters.menuItems}
        hiddenSet={menuFilters.hiddenSet}
        onToggleMenuItem={menuFilters.toggleMenuItem}
        onReset={menuFilters.resetAllVisible}
        onSetHiddenMenuItemIds={menuFilters.setHiddenMenuItemIds}
      />
    </div>
  )
}
