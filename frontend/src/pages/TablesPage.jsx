import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { readSalesEntryDate, todayYmd, writeSalesEntryDate } from '../lib/salesEntryDate.js'
import { toast } from '../lib/toast.js'

const OPEN_TABLES_CATEGORY = 'Acik Masalar'

const inferTableCategory = (table) => {
  const raw = String(table?.name || '').trim()
  if (!raw) return 'Diger'
  const normalized = raw
    .replace(/\s+\d+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || raw
}

const formatTime = (value) => {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

const getElapsedMinutes = (value, nowTs) => {
  if (!value) return null
  const date = new Date(value)
  const createdAtTs = date.getTime()
  if (!Number.isFinite(createdAtTs)) return null
  return Math.max(0, Math.floor((nowTs - createdAtTs) / 60000))
}

const getTableActivityTimestamp = (table, activeByTable, paidByTable) => {
  const active = activeByTable?.[table?.id] || {}
  const paid = paidByTable?.[table?.id] || {}
  const raw = paid?.createdAt || active?.createdAt || table?.updatedAt || table?.createdAt || null
  if (!raw) return 0
  const ts = new Date(raw).getTime()
  return Number.isFinite(ts) ? ts : 0
}

const getBorderColor = (active, paid, elapsedMinutes) => {
  if (!active?.hasActive) return '#22c55e'
  if (paid?.isPaid) return '#94a3b8'
  if (!Number.isFinite(elapsedMinutes)) return '#ef4444'
  if (elapsedMinutes >= 45) return '#ef4444'
  if (elapsedMinutes >= 30) return '#f59e0b'
  return '#22c55e'
}

export function TablesManagementContent({ embedded = false }) {
  const nav = useNavigate()
  const { user, allowedBranchIds } = useAuth()
  const canEditEntryDate = user?.role === 'tenant_admin'
  const { ids: allowed } = buildBranchQueryParams(allowedBranchIds)

  const [tables, setTables] = useState([])
  const [activeByTable, setActiveByTable] = useState({})
  const [paidByTable, setPaidByTable] = useState({})
  const [waiterCallsByTable, setWaiterCallsByTable] = useState({})
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [busyTableId, setBusyTableId] = useState(null)
  const [busyGlobal, setBusyGlobal] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [targetTable, setTargetTable] = useState(null)
  const [mergeSources, setMergeSources] = useState([])
  const [nowTs, setNowTs] = useState(Date.now())
  const [entryDate, setEntryDate] = useState(() => (canEditEntryDate ? readSalesEntryDate() : todayYmd()))

  const loadingRef = useRef(false)

  const parseApiError = (err) => {
    if (!err) return 'Bir hata olustu. Tekrar deneyin.'
    if (err?.name === 'AbortError') return null

    const status = err?.status
    const code = err?.data?.code || err?.data?.error || err?.code

    if (status === 409) {
      const messages = {
        table_in_use: 'Bu masada zaten aktif siparis var. Liste yenilendi.',
        order_not_editable: 'Bu siparis artik duzenlenemez. Liste yenilendi.',
        invalid_state: 'Islem yapilamadi. Liste yenilendi.'
      }
      return messages[code] || 'Islem yapilamadi. Liste yenilendi.'
    }

    if (status >= 500) return 'Bir hata olustu. Tekrar deneyin.'
    return err?.data?.message || err?.message || 'Bir hata olustu. Tekrar deneyin.'
  }

  const load = async (options = {}) => {
    if (!Array.isArray(allowedBranchIds)) return null

    if (allowed.length === 0) {
      setTables([])
      setActiveByTable({})
      setPaidByTable({})
      setWaiterCallsByTable({})
      setError('Sistem Ayarlari > Yetkili Subeler bolumunden sube secin')
      return null
    }

    if (loadingRef.current && !options.force) return null

    loadingRef.current = true
    setError('')

    try {
      const { params } = buildBranchQueryParams(allowedBranchIds)
      const url = params ? `/api/pos/tables/overview?${params.toString()}` : '/api/pos/tables/overview'
      const res = await api(url, { silent: true, skipBranchHeader: true, suppressBranchModal: true })

      if (res?.success === false) {
        setTables([])
        setActiveByTable({})
        setPaidByTable({})
        setWaiterCallsByTable({})
        setError(res.message || 'Bir hata olustu')
        return null
      }

      const nextTables = Array.isArray(res?.tables) ? res.tables : []
      const nextActiveByTable = res?.activeByTable || {}
      const nextPaidByTable = res?.paidByTable || {}
      const nextWaiterCallsByTable = res?.waiterCallsByTable || {}

      setTables(nextTables)
      setActiveByTable(nextActiveByTable)
      setPaidByTable(nextPaidByTable)
      setWaiterCallsByTable(nextWaiterCallsByTable)

      return {
        tables: nextTables,
        activeByTable: nextActiveByTable,
        paidByTable: nextPaidByTable,
        waiterCallsByTable: nextWaiterCallsByTable
      }
    } catch (err) {
      setError(err?.message || 'Bir hata olustu')
      return null
    } finally {
      loadingRef.current = false
    }
  }

  useEffect(() => {
    load()

    const onFocus = () => {
      if (!busyGlobal && !busyTableId) load({ reason: 'focus' })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !busyGlobal && !busyTableId) {
        load({ reason: 'visible' })
      }
    }
    const onBranchChanged = () => {
      if (!busyGlobal && !busyTableId) load({ reason: 'branch_changed', force: true })
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('allowed_branches_changed', onBranchChanged)
    const pollId = window.setInterval(() => {
      if (!busyGlobal && !busyTableId && document.visibilityState === 'visible') {
        load({ reason: 'poll' })
      }
    }, 5000)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('allowed_branches_changed', onBranchChanged)
      window.clearInterval(pollId)
    }
  }, [allowedBranchIds, busyGlobal, busyTableId])

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!canEditEntryDate) setEntryDate(todayYmd())
  }, [canEditEntryDate])

  const groupedTables = useMemo(() => {
    const baseGroups = tables.reduce((acc, table) => {
      const category = inferTableCategory(table)
      if (!acc[category]) acc[category] = []
      acc[category].push(table)
      return acc
    }, {})

    const openTables = tables
      .filter((table) => activeByTable?.[table?.id]?.hasActive)
      .sort((a, b) => getTableActivityTimestamp(a, activeByTable, paidByTable) - getTableActivityTimestamp(b, activeByTable, paidByTable))

    if (openTables.length > 0) {
      return {
        [OPEN_TABLES_CATEGORY]: openTables,
        ...baseGroups
      }
    }

    return baseGroups
  }, [tables, activeByTable, paidByTable])

  const categories = useMemo(() => {
    const baseCategories = Object.keys(groupedTables)
    if (!baseCategories.includes(OPEN_TABLES_CATEGORY)) return baseCategories
    return [
      OPEN_TABLES_CATEGORY,
      ...baseCategories.filter((category) => category !== OPEN_TABLES_CATEGORY)
    ]
  }, [groupedTables])

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategory('')
      return
    }
    if (!activeCategory || !categories.includes(activeCategory)) {
      setActiveCategory(categories.includes(OPEN_TABLES_CATEGORY) ? OPEN_TABLES_CATEGORY : categories[0])
    }
  }, [activeCategory, categories])

  const runTableAction = async (tableId, actionFn, options = {}) => {
    if (busyGlobal || busyTableId) return null

    setError('')
    setBusyTableId(tableId)
    if (options.global) setBusyGlobal(true)

    try {
      await actionFn()
      return await load({ reason: 'after_action', force: true })
    } catch (err) {
      const message = parseApiError(err)
      if (message) toast.error(message)
      if (err?.name !== 'AbortError') {
        return await load({ reason: 'after_error_sync', force: true })
      }
      return null
    } finally {
      setBusyTableId(null)
      setBusyGlobal(false)
    }
  }

  const onTableClick = async (table) => {
    if (busyGlobal || busyTableId) return

    const tableId = table?.id
    if (!tableId) {
      toast.error('Masa id bulunamadi')
      return
    }

    if (table?.branchId) {
      const branchId = String(table.branchId)
      const allowedStr = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String) : []
      if (allowedStr.length > 0 && !allowedStr.includes(branchId)) {
        toast.error('Bu masaya erisim yetkin yok')
        return
      }
      localStorage.setItem('selectedBranchId', branchId)
    }

    if ((waiterCallsByTable?.[tableId]?.count || 0) > 0) {
      try {
        await api(`/api/tenant/waiter-calls/table/${tableId}/resolve`, {
          method: 'PUT',
          body: JSON.stringify({}),
          silent: true,
          skipBranchHeader: true,
        })
        setWaiterCallsByTable((prev) => {
          const next = { ...(prev || {}) }
          delete next[tableId]
          return next
        })
      } catch (err) {
        toast.error(err?.message || 'Garson cagrisi kapatilamadi')
      }
    }

    const active = activeByTable[tableId]
    if (active?.hasActive && active?.orderId) {
      nav(`/kermes/app/pos?orderId=${active.orderId}`, { state: { fromTables: true, tableName: table?.name || '' } })
      return
    }

    const params = new URLSearchParams({ tableId })
    if (entryDate) params.set('entryDate', entryDate)
    nav(`/kermes/app/pos?${params.toString()}`, { state: { fromTables: true, tableName: table?.name || '' } })
  }

  const openMerge = (table) => {
    setTargetTable(table)
    setMergeSources([])
    setMergeOpen(true)
  }

  const toggleSource = (id) => {
    setMergeSources((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ))
  }

  const submitMerge = async () => {
    try {
      const latest = await runTableAction(
        targetTable?.id,
        async () => {
          if (targetTable?.branchId) {
            localStorage.setItem('selectedBranchId', String(targetTable.branchId))
          }
          await api(`/api/pos/tables/${targetTable.id}/merge`, {
            method: 'PUT',
            body: JSON.stringify({ sourceTableIds: mergeSources })
          })
          setMergeOpen(false)
        },
        { global: true }
      )

      const active = latest?.activeByTable?.[targetTable?.id]
      if (active?.orderId) {
        nav(`/kermes/app/pos?orderId=${active.orderId}`, { state: { fromTables: true, tableName: targetTable?.name || '' } })
      }
    } catch (err) {
      const message = parseApiError(err)
      if (message) toast.error(message)
    }
  }

  const totalWaiterCalls = useMemo(
    () => Object.values(waiterCallsByTable || {}).reduce((sum, item) => sum + Number(item?.count || 0), 0),
    [waiterCallsByTable]
  )

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Array.isArray(allowedBranchIds) && allowed.length === 0 && (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>
            Sube yetkisi yok. Ayarlar &gt; Sistem Ayarlari &gt; Yetkili Subeler bolumunden sube secin.
          </div>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {busyGlobal && <div style={{ color: 'var(--muted)', marginBottom: 8 }}>Islem suruyor...</div>}

      {categories.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className="btn"
                onClick={() => setActiveCategory(category)}
                style={{
                  fontWeight: activeCategory === category ? 800 : 700,
                  borderColor: activeCategory === category ? 'var(--border-hover)' : 'var(--app-border, var(--border))',
                  background: activeCategory === category ? 'var(--menu-active-bg, var(--card-hover))' : 'var(--app-surface, var(--panel))',
                  color: activeCategory === category ? 'var(--sidebar-nav-text-active, #ffffff)' : 'var(--app-text, var(--text))',
                  boxShadow: activeCategory === category ? 'none' : 'var(--card-shadow)',
                  borderWidth: 1.5,
                  borderStyle: 'solid',
                  borderRadius: 14,
                  padding: '10px 14px'
                }}
              >
                {category}
                <span style={{ marginLeft: 6, color: 'var(--muted)' }}>
                  ({groupedTables[category]?.length || 0})
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => nav('/kermes/app/waiter-calls')} style={{ flexShrink: 0 }}>
              Garson Cagrilari
              {totalWaiterCalls > 0 ? (
                <span
                  style={{
                    marginLeft: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 22,
                    height: 22,
                    padding: '0 6px',
                    borderRadius: 999,
                    background: '#f97316',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 900,
                    lineHeight: 1
                  }}
                >
                  {totalWaiterCalls}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      )}

      <div className="tablesGrid">
        {(groupedTables[activeCategory] || []).map((table) => {
          const active = activeByTable[table.id]
          const paid = paidByTable[table.id] || {}
          const waiterCall = waiterCallsByTable[table.id] || null
          const elapsedMinutes = getElapsedMinutes(paid?.createdAt, nowTs)
          const createdByName = String(paid?.createdByName || '').trim()
          const isAnyBusy = busyGlobal || !!busyTableId
          const isBusy = busyGlobal || busyTableId === table.id

          return (
            <div
              key={table.id}
              className="card"
              style={{
                cursor: isAnyBusy ? 'not-allowed' : 'pointer',
                position: 'relative',
                borderColor: getBorderColor(active, paid, elapsedMinutes),
                borderWidth: 1.5,
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                borderRadius: 18,
                background: 'var(--app-surface, var(--panel))',
                padding: 16,
                minHeight: 118,
                display: 'grid',
                alignContent: 'start',
                gap: 5
              }}
              onClick={() => (isAnyBusy ? null : onTableClick(table))}
            >
              {isBusy && (
                <span className="page-pill" style={{ position: 'absolute', top: 12, left: 12 }}>
                  Isleniyor
                </span>
              )}
              {paid?.isPaid && (
                <span className="page-pill" style={{ position: 'absolute', top: 12, right: 12 }}>
                  Odendi
                </span>
              )}
              {waiterCall?.count > 0 && (
                <span
                  className="page-pill"
                  style={{ position: 'absolute', right: 12, bottom: 12, background: '#f97316', color: '#fff', borderColor: '#f97316' }}
                >
                  Garson Cagiriyor
                </span>
              )}

              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.15, minHeight: 32 }}>
                {table.name}
              </div>

              {active?.hasActive && createdByName && (
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                  Siparisi Alan: {createdByName}
                </div>
              )}

              {waiterCall?.count > 0 && (
                <div style={{ fontSize: 12, color: '#c2410c', fontWeight: 800 }}>
                  Acik garson cagrisi var ({waiterCall.count})
                </div>
              )}

              {active?.hasActive && paid?.hasCancelAlert === true && (
                <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 800 }}>
                  Iptal var
                </div>
              )}

              {!!paid?.note && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {paid.note}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  fontSize: 12
                }}
              >
                <div style={{ color: !active?.hasActive ? '#22c55e' : (paid?.isPaid ? 'var(--muted)' : '#ef4444') }}>
                  {!active?.hasActive ? 'Bos' : (paid?.isPaid ? 'Dolu (Odendi)' : 'Dolu')}
                </div>
                {active?.hasActive && (
                  <div style={{ color: 'var(--muted)' }}>
                    {formatTime(paid?.createdAt)}
                    {elapsedMinutes !== null ? ` • ${elapsedMinutes} dk gecti` : ''}
                  </div>
                )}
              </div>

              {active?.hasActive && (
                <div style={{ marginTop: 2 }}>
                  <button
                    className="btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      openMerge(table)
                    }}
                    disabled={isAnyBusy}
                    style={{
                      padding: '6px 10px',
                      fontSize: 13,
                      borderRadius: 9
                    }}
                  >
                    Masa Birlestir
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {tables.length === 0 && (
          <div className="card">
            Masa tanimli degil. Isletme yoneticisi Ayarlar &gt; Masalar uzerinden ekleyebilir.
          </div>
        )}
      </div>

      <Modal
        open={mergeOpen}
        onClose={() => ((busyGlobal || !!busyTableId) ? null : setMergeOpen(false))}
        title="Masa Birlestir"
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Hedef: {targetTable?.name}</div>

          <div style={{ display: 'grid', gap: 8 }}>
            {tables
              .filter((table) => table.status !== 'empty' && table.id !== targetTable?.id)
              .map((table) => (
                <label key={table.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={mergeSources.includes(table.id)}
                    onChange={() => toggleSource(table.id)}
                    disabled={busyGlobal || !!busyTableId}
                  />
                  <div>{table.name}</div>
                </label>
              ))}

            {tables.filter((table) => table.status !== 'empty' && table.id !== targetTable?.id).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Birlestirilecek uygun masa yok.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn"
              onClick={submitMerge}
              disabled={mergeSources.length === 0 || busyGlobal || !!busyTableId}
            >
              Birlestir
            </button>
            <button className="btn" onClick={() => setMergeOpen(false)} disabled={busyGlobal || !!busyTableId}>
              Iptal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function TablesPage() {
  return <TablesManagementContent />
}


