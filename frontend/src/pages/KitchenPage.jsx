import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import InputModal from '../components/InputModal.jsx'
import MenuItemFilterDrawer from '../components/MenuItemFilterDrawer.jsx'
import { servingTypeLabelTR } from '../utils/servingType.js'
import { useKitchenMenuFilters } from '../lib/useKitchenMenuFilters.js'
import { useKitchenAlertSound } from '../lib/useKitchenAlertSound.js'

export default function KitchenPage() {
  const STATUS_LABELS_TR = {
    open: 'Bekliyor',
    sent: 'Hazırlanıyor',
    completed: 'Hazır',
    cancelled: 'İptal',
    closed: 'Kapandı'
  }

  const trKitchenStatusLabel = (status) => {
    const key = String(status || '').trim()
    return STATUS_LABELS_TR[key] || status
  }

  const trOrderServingType = (order) => {
    if (String(order?.saleType || '').trim() === 'delivery') return 'package'
    const raw = order?.servingType
    const v = String(raw || '').trim()
    if (v === 'tray' || v === 'plate' || v === 'package') return v
    return null
  }

  const getItemBgClass = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-orange-500'
      case 'cancelled':
        return 'bg-red-500'
      default:
        return 'bg-green-500'
    }
  }

  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelSelection, setCancelSelection] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const lastIdsRef = useRef([])
  const initialLoadedRef = useRef(false)

  const pickOrder = (res) => res?.data?.order ?? res?.order ?? null
  const { allowedBranchIds } = useAuth()
  const [filterOpen, setFilterOpen] = useState(false)
  const menuFilters = useKitchenMenuFilters({ scope: 'kitchen_normal' })
  const { soundEnabled, setSoundEnabled, ensureAudioUnlocked, playAlert } = useKitchenAlertSound()

  const load = async () => {
    setError('')
    try {
      if (!Array.isArray(allowedBranchIds)) {
        setOrders([])
        return
      }
      const { params } = buildBranchQueryParams(allowedBranchIds)
      if (!params) {
        setOrders([])
        return
      }
      const res = await api(`/api/kitchen/orders?${params.toString()}`, { skipBranchHeader: true, suppressBranchModal: true })
      const now = Date.now()
      const cutoffMins = 12 * 60
      const safe = (Array.isArray(res?.orders) ? res.orders : [])
        .filter(o => {
          if (!o?.createdAt) return true
          const createdTs = new Date(o.createdAt).getTime()
          const ageMins = Math.floor((now - createdTs) / 60000)
          return Number.isFinite(ageMins) && ageMins <= cutoffMins
        })
        .filter(o => !o?.status || o.status === 'open' || o.status === 'sent')
      const ids = safe.flatMap(o => {
        const batches = Array.isArray(o?.batches) ? o.batches : []
        if (batches.length === 0) return [String(o.id)]
        return batches.filter(b => b?.hasActiveItems).map(b => `${String(o.id)}:${String(b?.batchId || 'legacy')}`)
      })
      const prevIds = lastIdsRef.current || []

      setOrders(safe)
      lastIdsRef.current = ids

      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true
        return
      }

      const newIds = ids.filter(id => !prevIds.includes(id))
      if (newIds.length > 0) {
        await playAlert()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    initialLoadedRef.current = false
    lastIdsRef.current = []
    load()
    const id = setInterval(load, 5000)
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => {
      clearInterval(id)
      clearInterval(t)
    }
  }, [(Array.isArray(allowedBranchIds) ? allowedBranchIds : []).join(',')])

  useEffect(() => {
    try {
      localStorage.setItem('kitchenSoundEnabled', soundEnabled ? '1' : '0')
    } catch {}
  }, [soundEnabled])

  const soundIcon = useMemo(() => (soundEnabled ? '🔊' : '🔇'), [soundEnabled])

  const complete = async (id) => {
    try {
      const order = orders.find(o => o.id === id || o._id === id)
      if (!order) return
      await api(`/api/kitchen/orders/${order.id}/complete`, { method: 'PUT' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const completeBatch = async (orderId, batchId) => {
    try {
      await api(`/api/kitchen/orders/${orderId}/batches/${batchId}/complete`, { method: 'PUT' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const itemComplete = async (orderId, itemId) => {
    try {
      await api(`/api/kitchen/orders/${orderId}/items/${itemId}/complete`, { method: 'PUT' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const openCancelModal = (orderId, itemId) => {
    setCancelSelection({ orderId, itemId })
    setCancelReason('')
    setCancelModalOpen(true)
  }

  const submitCancel = async (reason) => {
    if (!cancelSelection) return
    try {
      const { orderId, itemId } = cancelSelection
      await api(`/api/kitchen/orders/${orderId}/items/${itemId}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) })
      await load()
      setCancelModalOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const ageColor = (createdAt) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (mins >= 45) return '#ef4444'
    if (mins >= 30) return '#f59e0b'
    return '#22c55e'
  }

  const getItemAgeMinutes = (order, item) => {
    const base =
      item?.kitchenSentAt ||
      item?.sentAt ||
      item?.createdAt ||
      order?.batchSentAt ||
      order?.createdAt
    if (!base) return 0
    const diff = Date.now() - new Date(base).getTime()
    const mins = Math.floor(diff / 60000)
    return mins < 0 ? 0 : mins
  }

  const cards = useMemo(() => {
    const list = Array.isArray(orders) ? orders : []
    const out = []
    for (const o of list) {
      const batches = Array.isArray(o?.batches) ? o.batches : []
      if (batches.length === 0) {
        out.push({ ...o, orderId: o.id, batchId: null, batchSentAt: o.createdAt, items: Array.isArray(o.items) ? o.items : [] })
        continue
      }
      for (const b of batches) {
        if (!b?.hasActiveItems) continue
        out.push({
          ...o,
          orderId: o.id,
          batchId: b.batchId,
          batchSentAt: b.batchSentAt,
          servingType: b.servingType,
          items: Array.isArray(b.items) ? b.items : []
        })
      }
    }
    out.sort((a, b) => new Date(b.batchSentAt || b.createdAt || 0).getTime() - new Date(a.batchSentAt || a.createdAt || 0).getTime())
    return out
  }, [orders])

  const visibleCards = useMemo(() => {
    const hidden = menuFilters.hiddenSet
    return (Array.isArray(cards) ? cards : [])
      .map(c => {
        const items = (Array.isArray(c?.items) ? c.items : []).filter(it => {
          const menuItemId = String(it?.menuItemId || '').trim()
          if (!menuItemId) return true
          return !hidden.has(menuItemId)
        })
        return { ...c, items }
      })
      .filter(c => (Array.isArray(c?.items) ? c.items.length : 0) > 0)
  }, [cards, menuFilters.hiddenSet])

  const filteredOut = false

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="stickyTop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Mutfağa Gelen Siparişler</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => setFilterOpen(true)}>Filtre</button>
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
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      {filteredOut && (
        <div className="card" style={{ borderColor: '#f59e0b', color: '#111827' }}>
          Filtreler tüm ürünleri gizliyor.
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={() => setFilterOpen(true)}>Filtreyi Aç</button>
            <button className="btn" type="button" onClick={() => menuFilters.resetAllVisible()}>Hepsini Aç</button>
          </div>
        </div>
      )}
      <div className="kitchenOrdersGrid">
        {visibleCards.map(o => (
          <div key={`${o._id || o.id}-${String(o.batchId || 'legacy')}`} className="card kitchenOrderCard" style={{ borderColor: ageColor(o.batchSentAt || o.createdAt) }}>
            {(() => {
              const titleLeft = o?.tableName
                ? String(o.tableName)
                : (o.saleType === 'delivery'
                  ? (o.customerName ? `Paket • ${o.customerName}` : 'Paket')
                  : (o.saleType === 'walkin'
                    ? (o.customerName ? `Hızlı • ${o.customerName}` : 'Hızlı Satış')
                    : (o?.orderNo ? `Sipariş ${o.orderNo}` : `Sipariş #${String(o.id).slice(-6)}`)
                  )
                )

              const sendTime = o.batchSentAt
                ? new Date(o.batchSentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                : '-'
              const servingType = trOrderServingType(o)
              const createdByName = String(o?.createdByName || '').trim()

              return (
                <div className="kitchen-card-header">
                  <div className="kitchen-card-info">
                    <span style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleLeft}</span>
                    <span className="kitchen-card-sep">•</span>
                    <span>{sendTime}</span>
                    {createdByName && (
                      <>
                        <span className="kitchen-card-sep">{' • '}</span>
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>SİP. VER. {createdByName}</span>
                      </>
                    )}
                  </div>
                  <div className="kitchen-card-badges">
                    {servingType && (
                      <span className="page-pill kitchen-badge kitchen-badge--serving">{servingTypeLabelTR(servingType) || '-'}</span>
                    )}
                  </div>
                </div>
              )
            })()}
            <div className="kitchenItemsList kitchenOrderItems" style={{ marginTop: 4 }}>
              {(Array.isArray(o.items) ? o.items : []).map((it, index) => {
                const orderServingType = trOrderServingType(o)
                const itemServingType = ['tray', 'plate', 'package'].includes(String(it?.servingType || '').trim()) ? String(it.servingType).trim() : null
                const showItemServingType = !!orderServingType && orderServingType !== 'package' && !!itemServingType && itemServingType !== orderServingType
                const showItemStatus = it?.status && String(it.status).trim() !== 'sent'
                const itemStatusLabel = showItemStatus ? trKitchenStatusLabel(it.status) : ''
                return (
                  <div
                    key={it._id || `${o._id || o.id}-${it.menuItemId}-${index}`}
                    className="kitchenItem"
                  >
                    <div
                      className={`${getItemBgClass(it.status)} kitchenItemBar`}
                    >
                      <div className="kitchenItemRow">
                        <div className="kitchenItemName">
                          {it?.isWeightBased
                            ? `${it.nameSnapshot} • ${Number(it?.weightGrams || 0)} gr`
                            : `${it.qty}x ${it.nameSnapshot}`}
                        </div>
                        <div className="kitchenItemAge">{getItemAgeMinutes(o, it)} dk</div>
                        <div className="kitchenItemActions">
                          {showItemServingType && (
                            <span className="page-pill kitchen-badge kitchen-badge--serving">{servingTypeLabelTR(itemServingType) || '-'}</span>
                          )}
                          {showItemStatus && (
                            <span className="page-pill kitchen-badge kitchen-badge--item-status">{itemStatusLabel || '-'}</span>
                          )}
                          <button
                            type="button"
                            className="btn btn--xs kitchenItemBtn"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              itemComplete(o.orderId || o.id, it._id)
                            }}
                            disabled={it.status !== 'sent'}
                          >
                            Hazır
                          </button>
                          <button
                            type="button"
                            className="btn btn--xs kitchenItemBtn"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              openCancelModal(o.orderId || o.id, it._id)
                            }}
                            disabled={it.status !== 'sent'}
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                      {!!it.note && <div className="kitchenItemNote">Not: {it.note}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="kitchenOrderFooter">
              <button
                type="button"
                className="btn btn--xs"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (o.batchId) completeBatch(o.orderId || o.id, o.batchId)
                  else complete(o.orderId || o.id)
                }}
                disabled={!Array.isArray(o.items) || o.items.length === 0}
              >
                Tamamlandı
              </button>
            </div>
          </div>
        ))}
      </div>
      <InputModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="İptal Sebebi"
        initialValue={cancelReason}
        placeholder="İptal sebebi..."
        onSubmit={submitCancel}
        autoFocus={false}
      />

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
