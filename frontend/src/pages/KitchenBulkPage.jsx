import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import MenuItemFilterDrawer from '../components/MenuItemFilterDrawer.jsx'
import { useKitchenMenuFilters } from '../lib/useKitchenMenuFilters.js'

export default function KitchenBulkPage() {
  const { allowedBranchIds } = useAuth()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const doneLocalRef = useRef(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const menuFilters = useKitchenMenuFilters({ scope: 'kitchen_bulk' })

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
    } catch (err) {
      setError(err?.message || 'Yükleme hatası')
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [(Array.isArray(allowedBranchIds) ? allowedBranchIds : []).join(',')])

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

  return (
    <div className="main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Toplu Ürün Hazırlama</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{totalCards} ürün</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setFilterOpen(true)} type="button">Filtre</button>
          <button className="btn" onClick={load} type="button">Yenile</button>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: '#ef4444', color: '#ef4444', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {visibleItems.map(card => {
          const rows = Array.isArray(card?.rows) ? card.rows : []
          return (
            <div key={String(card?.menuItemId || '')} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10, fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>
                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(card?.name || '-')}</div>
                <div style={{ whiteSpace: 'nowrap' }}>x{Math.max(0, Number(card?.totalQty || 0))}</div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {rows.map(r => {
                  const rowKey = String(r?.rowKey || '')
                  const tableName = String(r?.tableName || '')
                  const qty = Math.max(1, Number(r?.qty || 1))
                  const createdAt = r?.createdAt || null
                  return (
                    <div key={rowKey} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tableName || 'Sipariş'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          <span>x{qty}</span>
                          {createdAt ? <span> • {new Date(createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span> : null}
                        </div>
                      </div>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => doneRow(rowKey, { tableName, qty, createdAt })}
                      >
                        HAZIRLA
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <MenuItemFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        categories={menuFilters.menuCategories}
        menuItems={menuFilters.menuItems}
        hiddenSet={menuFilters.hiddenSet}
        onToggleMenuItem={menuFilters.toggleMenuItem}
        onReset={menuFilters.resetAllVisible}
      />
    </div>
  )
}
