import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { toast } from '../lib/toast.js'

const inferTableCategory = (table) => {
  const raw = String(table?.name || '').trim()
  if (!raw) return 'Diğer'
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

const getBorderColor = (active, paid, elapsedMinutes) => {
  if (!active?.hasActive) return '#22c55e'
  if (paid?.isPaid) return '#94a3b8'
  if (!Number.isFinite(elapsedMinutes)) return '#ef4444'
  if (elapsedMinutes >= 45) return '#ef4444'
  if (elapsedMinutes >= 30) return '#f59e0b'
  return '#22c55e'
}

export default function TablesPage() {
  const nav = useNavigate()
  const { allowedBranchIds } = useAuth()
  const { ids: allowed } = buildBranchQueryParams(allowedBranchIds)

  const [tables, setTables] = useState([])
  const [activeByTable, setActiveByTable] = useState({})
  const [paidByTable, setPaidByTable] = useState({})
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [busyTableId, setBusyTableId] = useState(null)
  const [busyGlobal, setBusyGlobal] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [targetTable, setTargetTable] = useState(null)
  const [mergeSources, setMergeSources] = useState([])
  const [nowTs, setNowTs] = useState(Date.now())

  const loadingRef = useRef(false)

  const parseApiError = (err) => {
    if (!err) return 'Bir hata oluştu. Tekrar deneyin.'
    if (err?.name === 'AbortError') return null

    const status = err?.status
    const code = err?.data?.code || err?.data?.error || err?.code

    if (status === 409) {
      const messages = {
        table_in_use: 'Bu masada zaten aktif sipariş var. Liste yenilendi.',
        order_not_editable: 'Bu sipariş artık düzenlenemez. Liste yenilendi.',
        invalid_state: 'İşlem yapılamadı. Liste yenilendi.'
      }
      return messages[code] || 'İşlem yapılamadı. Liste yenilendi.'
    }

    if (status >= 500) return 'Bir hata oluştu. Tekrar deneyin.'
    return err?.data?.message || err?.message || 'Bir hata oluştu. Tekrar deneyin.'
  }

  const load = async (options = {}) => {
    if (!Array.isArray(allowedBranchIds)) return null

    if (allowed.length === 0) {
      setTables([])
      setActiveByTable({})
      setPaidByTable({})
      setError('Sistem Ayarları > Yetkili Şubeler bölümünden şube seçin')
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
        setError(res.message || 'Bir hata oluştu')
        return null
      }

      const nextTables = Array.isArray(res?.tables) ? res.tables : []
      const nextActiveByTable = res?.activeByTable || {}
      const nextPaidByTable = res?.paidByTable || {}

      setTables(nextTables)
      setActiveByTable(nextActiveByTable)
      setPaidByTable(nextPaidByTable)

      return {
        tables: nextTables,
        activeByTable: nextActiveByTable,
        paidByTable: nextPaidByTable
      }
    } catch (err) {
      setError(err?.message || 'Bir hata oluştu')
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

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('allowed_branches_changed', onBranchChanged)
    }
  }, [allowedBranchIds, busyGlobal, busyTableId])

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const groupedTables = useMemo(() => {
    return tables.reduce((acc, table) => {
      const category = inferTableCategory(table)
      if (!acc[category]) acc[category] = []
      acc[category].push(table)
      return acc
    }, {})
  }, [tables])

  const categories = useMemo(() => Object.keys(groupedTables), [groupedTables])

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCategory('')
      return
    }
    if (!activeCategory || !categories.includes(activeCategory)) {
      setActiveCategory(categories[0])
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
      toast.error('Masa id bulunamadı')
      return
    }

    if (table?.branchId) {
      const branchId = String(table.branchId)
      const allowedStr = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String) : []
      if (allowedStr.length > 0 && !allowedStr.includes(branchId)) {
        toast.error('Bu masaya erişim yetkin yok')
        return
      }
      localStorage.setItem('selectedBranchId', branchId)
    }

    const active = activeByTable[tableId]
    if (active?.hasActive && active?.orderId) {
      nav(`/kermes/app/pos?orderId=${active.orderId}`, { state: { fromTables: true } })
      return
    }

    nav(`/kermes/app/pos?tableId=${tableId}`, { state: { fromTables: true } })
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
        nav(`/kermes/app/pos?orderId=${active.orderId}`, { state: { fromTables: true } })
      }
    } catch (err) {
      const message = parseApiError(err)
      if (message) toast.error(message)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="stickyTop" style={{ paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Masalar</h3>
        </div>
      </div>

      {Array.isArray(allowedBranchIds) && allowed.length === 0 && (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>
            Şube yetkisi yok. Ayarlar &gt; Sistem Ayarları &gt; Yetkili Şubeler bölümünden şube seçin.
          </div>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {busyGlobal && <div style={{ color: 'var(--muted)', marginBottom: 8 }}>İşlem sürüyor...</div>}

      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className="btn"
              onClick={() => setActiveCategory(category)}
              style={{
                fontWeight: activeCategory === category ? 800 : 700,
                borderColor: activeCategory === category ? '#111827' : '#d1d5db',
                background: activeCategory === category ? '#eef2ff' : '#ffffff',
                color: '#111827',
                boxShadow: activeCategory === category ? '0 6px 16px rgba(15, 23, 42, 0.10)' : '0 2px 8px rgba(15, 23, 42, 0.06)',
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
      )}

      <div className="tablesGrid">
        {(groupedTables[activeCategory] || []).map((table) => {
          const active = activeByTable[table.id]
          const paid = paidByTable[table.id] || {}
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
                background: '#ffffff',
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
                  İşleniyor
                </span>
              )}
              {paid?.isPaid && (
                <span className="page-pill" style={{ position: 'absolute', top: 12, right: 12 }}>
                  Ödendi
                </span>
              )}

              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.15, minHeight: 32 }}>
                {table.name}
              </div>

              {active?.hasActive && createdByName && (
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                  Siparişi Alan: {createdByName}
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
                  {!active?.hasActive ? 'Boş' : (paid?.isPaid ? 'Dolu (Ödendi)' : 'Dolu')}
                </div>
                {active?.hasActive && (
                  <div style={{ color: 'var(--muted)' }}>
                    {formatTime(paid?.createdAt)}
                    {elapsedMinutes !== null ? ` • ${elapsedMinutes} dk geçti` : ''}
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
                    Masa Birleştir
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {tables.length === 0 && (
          <div className="card">
            Masa tanımlı değil. İşletme yöneticisi Ayarlar &gt; Masalar üzerinden ekleyebilir.
          </div>
        )}
      </div>

      <Modal
        open={mergeOpen}
        onClose={() => ((busyGlobal || !!busyTableId) ? null : setMergeOpen(false))}
        title="Masa Birleştir"
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
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Birleştirilecek uygun masa yok.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn"
              onClick={submitMerge}
              disabled={mergeSources.length === 0 || busyGlobal || !!busyTableId}
            >
              Birleştir
            </button>
            <button className="btn" onClick={() => setMergeOpen(false)} disabled={busyGlobal || !!busyTableId}>
              İptal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
