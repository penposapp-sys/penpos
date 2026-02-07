import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast.js'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'

export default function TablesPage() {
  const { allowedBranchIds } = useAuth()
  const [tables, setTables] = useState([])
  const [error, setError] = useState('')
  const nav = useNavigate()
  const [busyTableId, setBusyTableId] = useState(null)
  const [busyGlobal, setBusyGlobal] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [targetTable, setTargetTable] = useState(null)
  const [mergeSources, setMergeSources] = useState([])
  const [paidByTable, setPaidByTable] = useState({})
  const [activeByTable, setActiveByTable] = useState({})
  const loadingRef = useRef(false)

  const { ids: allowed } = buildBranchQueryParams(allowedBranchIds)

  const parseApiError = (err) => {
    if (!err) return 'Bir hata oluştu. Tekrar deneyin.'
    if (err?.name === 'AbortError') return null

    const status = err?.status
    const code = err?.data?.code || err?.data?.error || err?.code

    if (status === 409) {
      const map = {
        table_in_use: 'Bu masada zaten aktif sipariş var. Liste yenilendi.',
        order_not_editable: 'Bu sipariş artık düzenlenemez. Liste yenilendi.',
        invalid_state: 'İşlem yapılamadı (durum uyuşmuyor). Liste yenilendi.'
      }
      return map[code] || 'İşlem yapılamadı. Liste yenilendi.'
    }
    if (status >= 500) return 'Bir hata oluştu. Tekrar deneyin.'
    return err?.data?.message || err?.message || 'Bir hata oluştu. Tekrar deneyin.'
  }

  const runTableAction = async (tableId, actionFn, opts = {}) => {
    const isGlobal = !!opts.global
    if (busyGlobal || busyTableId) return null

    setError('')
    setBusyTableId(tableId)
    if (isGlobal) setBusyGlobal(true)

    try {
      await actionFn()
      const latest = await load({ reason: 'after_action', force: true })
      return latest || null
    } catch (err) {
      const msg = parseApiError(err)
      if (msg) toast.error(msg)

      if (err?.name !== 'AbortError') {
        const latest = await load({ reason: 'after_error_sync' })
        return latest || null
      }
      return null
    } finally {
      setBusyTableId(null)
      setBusyGlobal(false)
    }
  }

  const load = async (_opts = {}) => {
    if (!Array.isArray(allowedBranchIds)) {
      return null
    }
    if (allowed.length === 0) {
      setTables([])
      setActiveByTable({})
      setPaidByTable({})
      setError('Sistem Ayarları > Yetkili Şubeler bölümünden şube seçin')
      return null
    }
    if (loadingRef.current && !_opts.force) return null
    loadingRef.current = true
    setError('')
    try {
      const { params } = buildBranchQueryParams(allowedBranchIds)
      const url = params ? `/api/pos/tables/overview?${params.toString()}` : '/api/pos/tables/overview'
      if (import.meta.env.DEV) {
        console.log('[TABLES_OVERVIEW_REQUEST]', {
          allowedBranchIds,
          normalizedIds: allowed,
          url
        })
      }
      const res = await api(url, { silent: true, skipBranchHeader: true, suppressBranchModal: true })
      if (res?.success === false) {
        setTables([])
        setActiveByTable({})
        setPaidByTable({})
        setError(res.message || 'Bir hata oluştu')
        return null
      }
      const { tables, activeByTable: activeMap = {}, paidByTable: paidMap = {} } = res || {}
      setTables(tables || [])
      setActiveByTable(activeMap)
      setPaidByTable(paidMap)
      return { tables: tables || [], activeByTable: activeMap, paidByTable: paidMap }
    } catch (err) {
      setError(err?.message || 'Bir hata oluştu')
    } finally {
      loadingRef.current = false
    }
  }
  useEffect(() => {
    load()
    const onFocus = () => {
      if (busyGlobal || busyTableId) return
      load({ reason: 'focus' })
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (busyGlobal || busyTableId) return
      load({ reason: 'visible' })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const onBranchChanged = () => {
      if (busyGlobal || busyTableId) return
      if (import.meta.env.DEV) console.log('[ALLOWED_BRANCHES_CHANGED]', allowedBranchIds)
      load({ reason: 'branch_changed', force: true })
    }
    window.addEventListener('allowed_branches_changed', onBranchChanged)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('allowed_branches_changed', onBranchChanged)
    }
  }, [allowedBranchIds])

  const onTableClick = async (t) => {
    if (busyGlobal || busyTableId) return
    try {
      const tableId = t?.id
      if (!tableId) {
        toast.error('Masa id bulunamadı')
        console.log('[TABLE_CLICK_NO_ID]', t)
        return
      }

      if (t?.branchId) {
        const branchIdStr = String(t.branchId)
        const allowedStr = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String) : []
        if (allowedStr.length > 0 && !allowedStr.includes(branchIdStr)) {
          toast.error('Bu masaya erişim yetkin yok (Şube uyuşmuyor)')
          return
        }
        localStorage.setItem('selectedBranchId', branchIdStr)
      }

      const active = activeByTable[tableId]
      if (active?.hasActive && active?.orderId) {
        nav(`/kermes/app/pos?orderId=${active.orderId}`, { replace: true })
      } else {
        nav(`/kermes/app/pos?tableId=${tableId}`, { replace: true })
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const openMerge = (t) => {
    setTargetTable(t)
    setMergeSources([])
    setMergeOpen(true)
  }

  const toggleSource = (id) => {
    setMergeSources(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const submitMerge = async () => {
    try {
      const latest = await runTableAction(
        targetTable?.id,
        async () => {
          if (targetTable?.branchId) {
            localStorage.setItem('selectedBranchId', String(targetTable.branchId))
          }
          await api(`/api/pos/tables/${targetTable.id}/merge`, { method: 'PUT', body: JSON.stringify({ sourceTableIds: mergeSources }) })
          setMergeOpen(false)
        },
        { global: true }
      )

      const active = latest?.activeByTable?.[targetTable?.id] || null
      if (active?.orderId) {
        nav(`/kermes/app/pos?orderId=${active.orderId}`, { replace: true })
      }
    } catch (err) {
      const msg = parseApiError(err)
      if (msg) toast.error(msg)
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
            Şube yetkisi yok. Ayarlar &gt; Sistem Ayarları &gt; Yetkili Şubeler’den şube seç.
          </div>
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {busyGlobal && <div style={{ color: 'var(--muted)', marginBottom: 8 }}>İşlem sürüyor…</div>}
      <div className="tablesGrid">
        {tables.map(t => {
          const isAnyBusy = busyGlobal || !!busyTableId
          const isBusy = busyGlobal || busyTableId === t.id
          return (
          <div
            key={t.id}
            className="card"
            style={{ cursor: isAnyBusy ? 'not-allowed' : 'pointer', position: 'relative', borderColor: (() => {
              const active = activeByTable[t.id]
              if (!active?.hasActive) return '#22c55e'
              const createdAt = paidByTable[t.id]?.createdAt
              if (!createdAt) return '#ef4444'
              const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
              if (mins >= 45) return '#ef4444'
              if (mins >= 30) return '#f59e0b'
              return '#22c55e'
            })() }}
            onClick={() => (isAnyBusy ? null : onTableClick(t))}
          >
            {isBusy && (
              <span className="page-pill" style={{ position: 'absolute', top: 12, left: 12 }}>İşleniyor</span>
            )}
            {paidByTable[t.id]?.isPaid && (
              <span className="page-pill" style={{ position: 'absolute', top: 12, right: 12 }}>Ödendi</span>
            )}
            <div style={{ fontWeight: 700 }}>{t.name}</div>
            {!!paidByTable[t.id]?.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{paidByTable[t.id].note}</div>}
            <div style={{ color: (!activeByTable[t.id]?.hasActive) ? '#22c55e' : (paidByTable[t.id]?.isPaid ? 'var(--muted)' : '#ef4444') }}>
              {!activeByTable[t.id]?.hasActive ? 'Boş' : (paidByTable[t.id]?.isPaid ? 'Dolu (Ödendi)' : 'Dolu')}
            </div>
            {activeByTable[t.id]?.hasActive && (
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={(e) => { e.stopPropagation(); openMerge(t) }} disabled={isAnyBusy}>Masa Birleştir</button>
              </div>
            )}
          </div>
          )
        })}
        {tables.length === 0 && (
          <div className="card">Masa tanımlı değil. İşletme yöneticisi “Ayarlar &gt; Masalar” üzerinden ekleyebilir.</div>
        )}
      </div>

      <Modal open={mergeOpen} onClose={() => ((busyGlobal || !!busyTableId) ? null : setMergeOpen(false))} title="Masa Birleştir">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Hedef: {targetTable?.name}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {tables.filter(x => x.status !== 'empty' && x.id !== targetTable?.id).map(t => (
              <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={mergeSources.includes(t.id)} onChange={() => toggleSource(t.id)} disabled={busyGlobal || !!busyTableId} />
                <div>{t.name}</div>
              </label>
            ))}
            {tables.filter(x => x.status !== 'empty' && x.id !== targetTable?.id).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Birleştirilecek uygun masa yok.</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={submitMerge} disabled={mergeSources.length === 0 || busyGlobal || !!busyTableId}>Birleştir</button>
            <button className="btn" onClick={() => setMergeOpen(false)} disabled={busyGlobal || !!busyTableId}>İptal</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
