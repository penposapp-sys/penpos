import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import InputModal from '../components/InputModal.jsx'
import MenuItemFilterDrawer from '../components/MenuItemFilterDrawer.jsx'
import { servingTypeLabelTR } from '../utils/servingType.js'
import { useKitchenMenuFilters } from '../lib/useKitchenMenuFilters.js'
import { useKitchenAlertSound } from '../lib/useKitchenAlertSound.js'

const SpeakerIcon = ({ muted = false }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 9v6h4l5 4V5l-5 4H5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {muted ? (
      <>
        <path d="M17 9l4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 9l-4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M18 9.5a4.5 4.5 0 0 1 0 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20.5 7a8 8 0 0 1 0 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    )}
  </svg>
)

const STATUS_LABELS_TR = {
  open: 'Bekliyor',
  sent: 'Hazirlaniyor',
  cooking: 'Ocakta',
  completed: 'Hazir',
  cancelled: 'Iptal',
  closed: 'Kapandi'
}

const trKitchenStatusLabel = (status) => {
  const key = String(status || '').trim()
  return STATUS_LABELS_TR[key] || status
}

const trOrderServingType = (order) => {
  if (String(order?.saleType || '').trim() === 'delivery') return 'package'
  const v = String(order?.servingType || '').trim()
  if (v === 'tray' || v === 'plate' || v === 'package') return v
  return null
}

const getItemBgColor = (status) => {
  switch (String(status || '').trim()) {
    case 'cooking':
      return '#93c5fd'
    case 'completed':
      return '#f59e0b'
    case 'cancelled':
      return '#ef4444'
    default:
      return '#22c55e'
  }
}

const buildGroupedItems = (items) => Object.values((Array.isArray(items) ? items : []).reduce((acc, it) => {
  const key = [
    String(it?.menuItemId || ''),
    String(it?.note || ''),
    String(it?.status || ''),
    String(it?.weightGrams || ''),
    String(it?.servingType || '')
  ].join('|')
  const prev = acc[key]
  if (!prev) {
    acc[key] = {
      ...it,
      qty: Math.max(1, Number(it?.qty || 1)),
      __rowKey: `group:${key}`,
      itemIds: [String(it?._id || '')].filter(Boolean)
    }
  } else {
    prev.qty += Math.max(1, Number(it?.qty || 1))
    if (it?._id) prev.itemIds.push(String(it._id))
  }
  return acc
}, {}))

const buildSeparateItems = (items) => (Array.isArray(items) ? items : []).flatMap((it, index) => {
  const qty = Math.max(1, Number(it?.qty || 1))
  if (it?.isWeightBased || qty <= 1) {
    return [{ ...it, __rowKey: it._id || `${it?.menuItemId || 'item'}-${index}` }]
  }
  return Array.from({ length: qty }, (_, unitIndex) => ({
    ...it,
    qty: 1,
    subtotal: Number(it?.priceSnapshot || 0),
    __unitIndex: unitIndex,
    __rowKey: `${it._id || `${it?.menuItemId || 'item'}-${index}`}:u:${unitIndex}`
  }))
})

export default function KitchenPage() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelSelection, setCancelSelection] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const lastIdsRef = useRef([])
  const initialLoadedRef = useRef(false)
  const restoreMainScrollTopRef = useRef(null)
  const { allowedBranchIds } = useAuth()
  const menuFilters = useKitchenMenuFilters({ scope: 'kitchen_normal' })
  const { soundEnabled, setSoundEnabled, ensureAudioUnlocked, playAlert } = useKitchenAlertSound()
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('kitchenViewMode') === 'separate' ? 'separate' : 'grouped'
    } catch {
      return 'grouped'
    }
  })

  const captureMainScrollTop = () => {
    try {
      const el = document.querySelector('.main')
      return el ? el.scrollTop : 0
    } catch {
      return 0
    }
  }

  const restoreMainScrollTop = () => {
    const top = restoreMainScrollTopRef.current
    if (top === null || top === undefined) return
    restoreMainScrollTopRef.current = null
    try {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const el = document.querySelector('.main')
          if (el) el.scrollTop = top
        })
      })
    } catch {}
  }

  const load = async ({ preserveScroll = false } = {}) => {
    setError('')
    if (preserveScroll) {
      restoreMainScrollTopRef.current = captureMainScrollTop()
    }
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
        .filter((o) => {
          if (!o?.createdAt) return true
          const createdTs = new Date(o.createdAt).getTime()
          const ageMins = Math.floor((now - createdTs) / 60000)
          return Number.isFinite(ageMins) && ageMins <= cutoffMins
        })
        .filter((o) => !o?.status || o.status === 'open' || o.status === 'sent')

      const ids = safe.flatMap((o) => {
        const batches = Array.isArray(o?.batches) ? o.batches : []
        if (batches.length === 0) return [String(o.id)]
        return batches
          .filter((b) => !b?.completedAt && b?.hasActiveItems)
          .map((b) => `${String(o.id)}:${String(b?.batchId || 'legacy')}`)
      })
      const prevIds = lastIdsRef.current || []

      setOrders(safe)
      restoreMainScrollTop()
      lastIdsRef.current = ids

      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true
        return
      }

      const newIds = ids.filter((id) => !prevIds.includes(id))
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
    const t = setInterval(() => setTick((x) => x + 1), 30000)
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

  useEffect(() => {
    try {
      localStorage.setItem('kitchenViewMode', viewMode)
    } catch {}
  }, [viewMode])

  const complete = async (id) => {
    try {
      await api(`/api/kitchen/orders/${id}/complete`, { method: 'PUT' })
      await load({ preserveScroll: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const completeBatch = async (orderId, batchId) => {
    try {
      await api(`/api/kitchen/orders/${orderId}/batches/${batchId}/complete`, { method: 'PUT' })
      await load({ preserveScroll: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const itemCooking = async (orderId, itemId, unitIndex = 0) => {
    try {
      await api(`/api/kitchen/orders/${orderId}/items/${itemId}/cooking`, {
        method: 'PUT',
        body: JSON.stringify({ unitIndex })
      })
      await load({ preserveScroll: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const itemGroupCooking = async (orderId, itemIds) => {
    try {
      await api(`/api/kitchen/orders/${orderId}/items/group-cooking`, {
        method: 'PUT',
        body: JSON.stringify({ itemIds: Array.isArray(itemIds) ? itemIds : [] })
      })
      await load({ preserveScroll: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const itemComplete = async (orderId, itemId, unitIndex = 0) => {
    try {
      await api(`/api/kitchen/orders/${orderId}/items/${itemId}/complete`, {
        method: 'PUT',
        body: JSON.stringify({ unitIndex })
      })
      await load({ preserveScroll: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const itemGroupComplete = async (orderId, itemIds) => {
    try {
      await api(`/api/kitchen/orders/${orderId}/items/group-complete`, {
        method: 'PUT',
        body: JSON.stringify({ itemIds: Array.isArray(itemIds) ? itemIds : [] })
      })
      await load({ preserveScroll: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const openCancelModal = (orderId, itemIdOrIds, grouped = false, unitIndex = 0) => {
    const itemIds = Array.isArray(itemIdOrIds)
      ? itemIdOrIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [String(itemIdOrIds || '').trim()].filter(Boolean)
    setCancelSelection({ orderId, itemIds, grouped: grouped === true, unitIndex })
    setCancelReason('')
    setCancelModalOpen(true)
  }

  const submitCancel = async (reason) => {
    if (!cancelSelection) return
    try {
      const { orderId, itemIds, grouped, unitIndex } = cancelSelection
      const ids = Array.isArray(itemIds) ? itemIds : []
      if (grouped) {
        await api(`/api/kitchen/orders/${orderId}/items/group-cancel`, {
          method: 'PUT',
          body: JSON.stringify({ itemIds: ids, reason })
        })
      } else if (ids.length === 1) {
        await api(`/api/kitchen/orders/${orderId}/items/${ids[0]}/cancel`, {
          method: 'PUT',
          body: JSON.stringify({ reason, unitIndex })
        })
      }
      await load({ preserveScroll: true })
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
    const base = item?.kitchenSentAt || item?.sentAt || item?.createdAt || order?.batchSentAt || order?.createdAt
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
        if (b?.completedAt) continue
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
    return cards
      .map((c) => {
        const items = (Array.isArray(c?.items) ? c.items : []).filter((it) => {
          const menuItemId = String(it?.menuItemId || '').trim()
          if (!menuItemId) return true
          return !hidden.has(menuItemId)
        })
        return { ...c, items }
      })
      .filter((c) => (Array.isArray(c?.items) ? c.items.length : 0) > 0)
  }, [cards, menuFilters.hiddenSet])

  const cardsWithDisplayItems = useMemo(() => {
    return visibleCards
      .map((card) => {
        const filtered = (Array.isArray(card?.items) ? card.items : []).filter((it) =>
          ['sent', 'cooking', 'completed', 'cancelled'].includes(String(it?.status || ''))
        )
        const displayItems = viewMode === 'grouped' ? buildGroupedItems(filtered) : buildSeparateItems(filtered)
        return { ...card, displayItems }
      })
      .filter((card) => (Array.isArray(card?.displayItems) ? card.displayItems.length : 0) > 0)
  }, [visibleCards, viewMode])

  const renderCardList = (cardList) => (
    <div className="kitchenOrdersGrid">
      {(Array.isArray(cardList) ? cardList : []).map((o) => {
        const titleLeft = o?.tableName
          ? String(o.tableName)
          : (o.saleType === 'delivery'
            ? (o.customerName ? `Paket • ${o.customerName}` : 'Paket')
            : (o.saleType === 'walkin'
              ? (o.customerName ? `Hizli • ${o.customerName}` : 'Hizli Satis')
              : (o?.orderNo ? `Siparis ${o.orderNo}` : `Siparis #${String(o.id).slice(-6)}`)))
        const sendTime = o.batchSentAt
          ? new Date(o.batchSentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          : '-'
        const servingType = trOrderServingType(o)
        const createdByName = String(o?.createdByName || '').trim()

        return (
          <div key={`${o._id || o.id}-${String(o.batchId || 'legacy')}`} className="card kitchenOrderCard" style={{ borderColor: ageColor(o.batchSentAt || o.createdAt) }}>
            <div className="kitchen-card-header">
              <div className="kitchen-card-info">
                <span style={{ fontWeight: 700, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{titleLeft}</span>
                <span className="kitchen-card-sep">•</span>
                <span>{sendTime}</span>
                {createdByName && (
                  <>
                    <span className="kitchen-card-sep">{' • '}</span>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>SIP. VER. {createdByName}</span>
                  </>
                )}
              </div>
              <div className="kitchen-card-badges">
                {servingType && (
                  <span className="page-pill kitchen-badge kitchen-badge--serving">{servingTypeLabelTR(servingType) || '-'}</span>
                )}
              </div>
            </div>

            <div className="kitchenItemsList kitchenOrderItems" style={{ marginTop: 4 }}>
              {(Array.isArray(o.displayItems) ? o.displayItems : []).map((it, index) => {
                const orderServingType = trOrderServingType(o)
                const itemServingType = ['tray', 'plate', 'package'].includes(String(it?.servingType || '').trim()) ? String(it.servingType).trim() : null
                const showItemServingType = !!orderServingType && orderServingType !== 'package' && !!itemServingType && itemServingType !== orderServingType
                const showItemStatus = it?.status && String(it.status).trim() !== 'sent'
                const itemStatusLabel = showItemStatus ? trKitchenStatusLabel(it.status) : ''
                const actionItemId = Array.isArray(it?.itemIds) && it.itemIds.length > 0 ? String(it.itemIds[0]) : String(it?._id || '')
                const actionItemIds = Array.isArray(it?.itemIds) && it.itemIds.length > 0
                  ? it.itemIds.map((id) => String(id || '').trim()).filter(Boolean)
                  : [String(it?._id || '').trim()].filter(Boolean)
                const actionUnitIndex = Number.isFinite(Number(it?.__unitIndex)) ? Number(it.__unitIndex) : 0

                return (
                  <div key={it.__rowKey || it._id || `${o._id || o.id}-${it.menuItemId}-${index}`} className="kitchenItem">
                    <div className="kitchenItemBar" style={{ backgroundColor: getItemBgColor(it.status) }}>
                      <div className="kitchenItemRow">
                        <div className="kitchenItemName">
                          {it?.isWeightBased
                            ? `${it.nameSnapshot} • ${Number(it?.weightGrams || 0)} gr`
                            : <><span style={{ color: '#dc2626', fontWeight: 800 }}>{it.qty} ADET</span>{' '}<span>{it.nameSnapshot}</span></>}
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
                              if (viewMode === 'grouped') {
                                itemGroupCooking(o.orderId || o.id, actionItemIds)
                                return
                              }
                              itemCooking(o.orderId || o.id, actionItemId, actionUnitIndex)
                            }}
                            disabled={it.status !== 'sent' || actionItemIds.length === 0}
                          >
                            Ocakta
                          </button>
                          <button
                            type="button"
                            className="btn btn--xs kitchenItemBtn"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (viewMode === 'grouped') {
                                itemGroupComplete(o.orderId || o.id, actionItemIds)
                                return
                              }
                              itemComplete(o.orderId || o.id, actionItemId, actionUnitIndex)
                            }}
                            disabled={!['sent', 'cooking'].includes(String(it.status || '')) || (viewMode === 'grouped' ? actionItemIds.length === 0 : !actionItemId)}
                          >
                            Hazir
                          </button>
                          <button
                            type="button"
                            className="btn btn--xs kitchenItemBtn"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (viewMode === 'grouped') {
                                openCancelModal(o.orderId || o.id, actionItemIds, true)
                                return
                              }
                              openCancelModal(o.orderId || o.id, actionItemId, false, actionUnitIndex)
                            }}
                            disabled={!['sent', 'cooking'].includes(String(it.status || '')) || actionItemIds.length === 0}
                          >
                            Iptal
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
                Tamamlandi
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )

  const filteredOut = false

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="stickyTop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => setViewMode('grouped')} aria-pressed={viewMode === 'grouped'}>Toplu</button>
          <button type="button" className="btn" onClick={() => setViewMode('separate')} aria-pressed={viewMode === 'separate'}>Ayri</button>
          <button type="button" className="btn" onClick={() => setFilterOpen(true)}>Filtre</button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (next) await ensureAudioUnlocked()
            }}
            title={soundEnabled ? 'Ses Acik (Kapat)' : 'Ses Kapali (Ac)'}
          >
            <SpeakerIcon muted={!soundEnabled} />
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444' }}>{error}</div>}

      {filteredOut && (
        <div className="card" style={{ borderColor: '#f59e0b', color: '#111827' }}>
          Filtreler tum urunleri gizliyor.
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={() => setFilterOpen(true)}>Filtreyi Ac</button>
            <button className="btn" type="button" onClick={() => menuFilters.resetAllVisible()}>Hepsini Ac</button>
          </div>
        </div>
      )}

      {renderCardList(cardsWithDisplayItems)}

      <InputModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Iptal Sebebi"
        initialValue={cancelReason}
        placeholder="Iptal sebebi..."
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
