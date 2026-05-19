import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import Modal from '../../components/Modal.jsx'
import CanteenBranchSelector from '../components/CanteenBranchSelector.jsx'
import useScannerCapture from '../hooks/useScannerCapture.js'
import { stockActionLabel, stockNoteLabel, stockSourceLabel } from '../utils/stockLabels.js'
import { getStockCountDetail, getStockCounts } from '../lib/api.js'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CanteenStockPage() {
  const { me } = useOutletContext()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const isAdmin = me?.role === 'tenant_admin'
  const perms = Array.isArray(me?.permissions) ? me.permissions : []
  const canStock = isAdmin || perms.includes('canteen_stock_manage') || perms.includes('canteen_stock_count') || perms.includes('canteen_settings_manage')

  const [tab, setTab] = useState('movements')
  const [branchId, setBranchId] = useState(() => {
    try {
      return String(localStorage.getItem('selectedBranchId_canteen') || '')
    } catch {
      return ''
    }
  })

  useEffect(() => {
    const handler = (e) => setBranchId(String(e?.detail?.branchId || ''))
    window.addEventListener('canteen_branch_changed', handler)
    return () => window.removeEventListener('canteen_branch_changed', handler)
  }, [])

  const movementOnScanRef = useRef(null)
  const countOnScanRef = useRef(null)
  const isCompact = isMobilePortrait || isTablet

  useScannerCapture({
    enabled: true,
    minLen: 8,
    maxLen: 32,
    idleMs: 110,
    burstDeltaMs: 50,
    humanDeltaMs: 70,
    onScan: (code) => {
      if (tab === 'movements') movementOnScanRef.current?.(code)
      else if (tab === 'count') countOnScanRef.current?.(code)
    }
  })

  if (!canStock) return <div className="card">403 – Bu sayfaya yetkin yok</div>

  return (
    <div className="canteen-stock-page" style={{ display: 'grid', gap: 12 }}>
      <div className="stickyTop" style={{ display: 'grid', gap: 10, paddingBottom: 12 }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Stok</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Barkod ile hareket ve sayım.</div>
          </div>
          <CanteenBranchSelector compact />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => setTab('movements')} aria-pressed={tab === 'movements'}>Hareket</button>
          <button className="btn" type="button" onClick={() => setTab('count')} aria-pressed={tab === 'count'}>Sayım</button>
        </div>
      </div>

      {tab === 'movements' && <StockMovementsPanel branchId={branchId} onScanRef={movementOnScanRef} isCompact={isCompact} />}
      {tab === 'count' && <StockCountPanel branchId={branchId} onScanRef={countOnScanRef} me={me} isCompact={isCompact} />}
    </div>
  )
}

function StockMovementsPanel({ branchId, onScanRef, isCompact = false }) {
  const barcodeRef = useRef(null)
  const [barcode, setBarcode] = useState('')
  const [type, setType] = useState('in')
  const [qtyStr, setQtyStr] = useState('1')
  const [note, setNote] = useState('')
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const errorTimerRef = useRef(null)

  const canUse = String(branchId || '').trim().length > 0

  const focusBarcode = () => {
    try { barcodeRef.current?.focus() } catch {}
  }

  useEffect(() => {
    const t = setTimeout(() => focusBarcode(), 0)
    return () => clearTimeout(t)
  }, [])

  const loadMovements = async () => {
    if (!canUse) {
      setItems([])
      return
    }
    const res = await api(`/api/canteen/stock/movements?branchId=${encodeURIComponent(String(branchId))}`, { silent: true })
    setItems(Array.isArray(res?.items) ? res.items : [])
  }

  useEffect(() => {
    loadMovements()
  }, [branchId])

  const lookup = async (code, { final = false } = {}) => {
    const c = String(code || '').trim()
    if (!c || !canUse) return
    const res = await api(`/api/canteen/products/by-barcode/${encodeURIComponent(c)}`, { silent: true, headers: { 'x-branch-id': String(branchId) } })
    if (!res?.ok || !res?.product) {
      if (final && res?.code === 'not_found') {
        setError('Barkod bulunamadı')
        try { clearTimeout(errorTimerRef.current) } catch {}
        errorTimerRef.current = setTimeout(() => setError(''), 2000)
      }
      setProduct(null)
      return
    }
    setError('')
    setProduct(res.product)
  }

  const onSelectProduct = (p) => {
    setError('')
    setProduct(p)
    setBarcode(String(p?.barcode || ''))
    setTimeout(() => focusBarcode(), 0)
  }

  useEffect(() => {
    if (!onScanRef) return
    onScanRef.current = (code) => {
      if (!canUse) return
      const c = String(code || '').trim()
      if (!c) return
      setError('')
      setBarcode(c)
      lookup(c, { final: true })
      setTimeout(() => focusBarcode(), 0)
    }
    return () => {
      if (onScanRef.current) onScanRef.current = null
    }
  }, [onScanRef, canUse, branchId])

  const qtyNum = useMemo(() => {
    const n = Number(String(qtyStr || '').replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
  }, [qtyStr])
  const qtyValid = String(qtyStr || '').trim() !== '' && Number.isFinite(qtyNum) && qtyNum > 0

  const submit = async () => {
    if (!canUse) return toast.error('Şube seç')
    const bc = String(barcode || '').trim()
    if (!bc) return toast.error('Barkod zorunlu')
    if (!qtyValid) return toast.error('Miktar geçersiz')
    if (!product) return toast.error('Önce ürün bulunmalı')
    setLoading(true)
    const res = await api('/api/canteen/stock/movements', {
      method: 'POST',
      data: { type, qty: qtyNum, note: String(note || '').trim(), productId: product?.id ? String(product.id) : undefined, barcode: product?.id ? undefined : bc },
      headers: { 'x-branch-id': String(branchId) },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Kaydedilemedi')
      setLoading(false)
      focusBarcode()
      return
    }
    const nextQty = Number(res?.product?.stockQty || 0)
    setProduct(prev => prev ? { ...prev, stockQty: nextQty } : prev)
    setBarcode('')
    setQtyStr('1')
    setNote('')
    setError('')
    setProduct(null)
    await loadMovements()
    setLoading(false)
    setTimeout(() => focusBarcode(), 150)
  }

  return (
    <div className="stockPanels">
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <ProductSearchBox branchId={branchId} onSelect={onSelectProduct} disabled={!canUse || loading} />
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod okut</div>
          <input
            className="input"
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              await lookup(barcode, { final: true })
              focusBarcode()
            }}
            placeholder="Barkod"
            inputMode="numeric"
            disabled={!canUse || loading}
          />
        </label>

        {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

        {product && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Ürün: <span style={{ color: 'var(--text)', fontWeight: 800 }}>{product.name}</span> | Mevcut Stok: <span style={{ color: 'var(--text)', fontWeight: 800 }}>{Number(product.stockQty || 0)}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'in', label: 'Giriş' },
            { key: 'out', label: 'Çıkış' },
            { key: 'waste', label: 'Fire' },
            { key: 'adjust', label: 'Düzeltme' }
          ].map(x => (
            <button key={x.key} className="btn" type="button" onClick={() => setType(x.key)} aria-pressed={type === x.key} disabled={loading}>
              {x.label}
            </button>
          ))}
        </div>

        {product && (
          <div className="card" style={{ padding: 12, background: '#f9fafb' }}>
            <div style={{ fontWeight: 800 }}>{product.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {product.barcode}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Fiyat: {money(product.price)} ₺</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>Mevcut stok: {Number(product.stockQty || 0)}</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '1fr 1fr', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Miktar</div>
            <input
              className="input"
              value={qtyStr}
              inputMode="numeric"
              onChange={(e) => {
                const v = e.target.value
                if (!/^\d*$/.test(String(v))) return
                setQtyStr(v)
              }}
              disabled={!canUse || loading}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} disabled={!canUse || loading} />
          </label>
        </div>

        <button
          className="btn btn--primary btn--large"
          type="button"
          onClick={submit}
          disabled={!canUse || loading || !String(barcode || '').trim() || !product || !type || !qtyValid}
        >
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </button>

        {!canUse && <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div>}
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Son Hareketler</div>
          <button className="btn btn--compact" type="button" onClick={loadMovements} disabled={!canUse || loading}>Yenile</button>
        </div>
        <div style={{ display: 'grid', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
          {items.map(m => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div className="breakAny" style={{ fontWeight: 800 }}>{stockActionLabel(m.type)} • {m.productName || 'Ürün'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {m.barcode || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{m.createdAt ? new Date(m.createdAt).toLocaleString('tr-TR') : ''}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Kaynak: {stockSourceLabel(m.note)}</div>
                {!!stockNoteLabel(m.note) && <div className="breakAny" style={{ color: 'var(--muted)', fontSize: 12 }}>Not: {stockNoteLabel(m.note)}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Miktar</div>
                <div style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>{Number(m.qty || 0)}</div>
              </div>
            </div>
          ))}
          {!loading && items.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>
    </div>
  )
}

function StockCountPanel({ branchId, onScanRef, me, isCompact = false }) {
  const barcodeRef = useRef(null)
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sessionStatus, setSessionStatus] = useState('')
  const [last, setLast] = useState(null)
  const [rows, setRows] = useState([])
  const [uiQtyById, setUiQtyById] = useState({})
  const editingIdsRef = useRef(new Set())
  const [summary, setSummary] = useState(null)
  const saveTimersRef = useRef(new Map())
  const lastCommittedRef = useRef(new Map())

  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [historyRangeDays, setHistoryRangeDays] = useState(30)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)

  const canUse = String(branchId || '').trim().length > 0
  const canViewHistory = (() => {
    try {
      const role = me?.role
      const perms = Array.isArray(me?.permissions) ? me.permissions : []
      return role === 'tenant_admin' || perms.includes('canteen_stock_count_view')
    } catch {
      return false
    }
  })()

  const focusBarcode = () => {
    try { barcodeRef.current?.focus() } catch {}
  }

  useEffect(() => {
    const t = setTimeout(() => focusBarcode(), 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    setSessionId('')
    setSessionStatus('')
    setSummary(null)
    setRows([])
    setUiQtyById({})
    editingIdsRef.current = new Set()
    setLast(null)
    setBarcode('')
    setQty('')
  }, [branchId])

  const loadHistory = async () => {
    if (!canUse || !canViewHistory) {
      setHistoryItems([])
      setHistoryError('')
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    const from = (() => {
      const n = Number(historyRangeDays || 0)
      if (!Number.isFinite(n) || n <= 0) return ''
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString()
    })()
    const res = await getStockCounts(branchId, { limit: 20, from })
    if (!res?.ok) {
      setHistoryError(res?.message || 'Geçmiş sayımlar yüklenemedi')
      setHistoryItems([])
      setHistoryLoading(false)
      return
    }
    setHistoryItems(Array.isArray(res?.items) ? res.items : [])
    setHistoryLoading(false)
  }

  const openDetail = async (id) => {
    const sid = String(id || '').trim()
    if (!sid || !canUse || !canViewHistory) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    const res = await getStockCountDetail(branchId, sid)
    setDetailLoading(false)
    if (!res?.ok) {
      setDetailError(res?.message || 'Detay yüklenemedi')
      return
    }
    setDetail({ count: res?.count || null, lines: Array.isArray(res?.lines) ? res.lines : [] })
  }

  useEffect(() => {
    loadHistory()
  }, [canUse, canViewHistory, historyRangeDays, branchId])

  const storageKey = useMemo(() => {
    const bid = String(branchId || '').trim()
    return bid ? `canteen_stock_count_session_${bid}` : ''
  }, [branchId])

  const loadSummary = async (sid) => {
    const id = String(sid || '').trim()
    if (!id) return
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(id)}/summary`, { headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.summary) {
      try { if (storageKey) localStorage.removeItem(storageKey) } catch {}
      setSessionId('')
      setSessionStatus('')
      setSummary(null)
      setRows([])
      setLast(null)
      return
    }
    const s = res.summary
    setSessionId(String(s?.session?.id || id))
    setSessionStatus(String(s?.session?.status || ''))
    setSummary(s)
    const items = Array.isArray(s?.items) ? s.items : []
    setRows(items.map(x => ({
      itemId: String(x.itemId || ''),
      productId: String(x.productId || ''),
      barcode: String(x.barcode || ''),
      name: String(x.productName || ''),
      countedQty: Number(x.countedQty || 0),
      saving: false,
      savedAt: null
    })))
    setUiQtyById(prev => {
      const next = { ...(prev || {}) }
      for (const it of items) {
        const id = String(it.itemId || '')
        if (!id) continue
        if (editingIdsRef.current.has(id)) continue
        next[id] = String(Number(it.countedQty || 0))
      }
      return next
    })
    for (const it of items) {
      lastCommittedRef.current.set(String(it.itemId || ''), Number(it.countedQty || 0))
    }
  }

  useEffect(() => {
    if (!canUse) return
    try {
      const sid = storageKey ? String(localStorage.getItem(storageKey) || '') : ''
      if (sid) loadSummary(sid)
    } catch {}
  }, [canUse, storageKey])

  useEffect(() => {
    if (!onScanRef) return
    onScanRef.current = (code) => {
      if (!canUse) return
      if (sessionStatus !== 'open') return
      const c = String(code || '').trim()
      if (!c) return
      if (!sessionId) return
      scan(c, qty)
    }
    return () => {
      if (onScanRef.current) onScanRef.current = null
    }
  }, [onScanRef, canUse, sessionId, qty, sessionStatus])

  const start = async () => {
    if (!canUse) return toast.error('Şube seç')
    setLoading(true)
    const res = await api('/api/canteen/stock-counts', { method: 'POST', headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.sessionId) {
      toast.error(res?.message || 'Sayım başlatılamadı')
      setLoading(false)
      return
    }
    setSessionId(String(res.sessionId))
    setSessionStatus('open')
    setSummary(null)
    setRows([])
    setLast(null)
    setBarcode('')
    setQty('')
    try { if (storageKey) localStorage.setItem(storageKey, String(res.sessionId)) } catch {}
    setLoading(false)
    focusBarcode()
  }

  const scan = async (codeRaw, qtyRaw, opts = {}) => {
    if (!canUse) return
    if (!sessionId) return toast.error('Önce sayım başlat')
    if (sessionStatus !== 'open') return
    const code = String(codeRaw || '').trim()
    const productId = String(opts?.productId || '').trim()
    if (!code && !productId) return
    const q = qtyRaw === undefined || qtyRaw === null || String(qtyRaw).trim() === '' ? 1 : Number(String(qtyRaw).replace(',', '.'))
    if (!Number.isFinite(q) || q <= 0) return toast.error('Miktar geçersiz')
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/scan`, {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      data: { qty: q, barcode: productId ? undefined : code, productId: productId ? productId : undefined },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.code === 'not_found' ? 'Ürün bulunamadı' : (res?.message || 'İşlem başarısız'))
      setLoading(false)
      focusBarcode()
      return
    }
    const itemId = String(res?.item?.itemId || '')
    const bc = String(res?.item?.barcode || code || '')
    const name = String(res?.product?.name || '')
    const stockQty = Number(res?.product?.stockQty || 0)
    const countedQty = Number(res?.item?.countedQty || 0)
    setLast({ itemId, barcode: bc, name, countedQty, stockQty })
    setRows(prev => {
      const next = Array.isArray(prev) ? [...prev] : []
      const idx = itemId ? next.findIndex(x => String(x.itemId) === itemId) : next.findIndex(x => String(x.barcode) === bc)
      const row = { itemId, productId: String(res?.item?.productId || ''), barcode: bc, name, countedQty, stockQty, saving: false, savedAt: null }
      if (idx >= 0) next[idx] = { ...next[idx], ...row }
      else next.unshift(row)
      return next
    })
    if (itemId) lastCommittedRef.current.set(itemId, countedQty)
    if (itemId) {
      setUiQtyById(prev => {
        if (editingIdsRef.current.has(itemId)) return prev
        return { ...(prev || {}), [itemId]: String(countedQty) }
      })
    }
    setBarcode('')
    setLoading(false)
    focusBarcode()
  }

  const updateRowCountedQty = (itemId, nextQty) => {
    const id = String(itemId || '').trim()
    if (!id) return
    const raw = String(nextQty ?? '')
    if (!/^[0-9]*$/.test(raw)) return

    setUiQtyById(prev => ({ ...(prev || {}), [id]: raw }))
    setRows(prev => prev.map(r => String(r.itemId) === id ? { ...r, saving: true } : r))

    const timers = saveTimersRef.current
    if (timers.has(id)) {
      try { clearTimeout(timers.get(id)) } catch {}
    }
    const valueNow = raw
    timers.set(id, setTimeout(async () => {
      if (String(valueNow || '').trim() === '') {
        setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, saving: false } : r))
        return
      }

      const qty = Number(valueNow)
      if (!Number.isFinite(qty) || qty < 0) {
        setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, saving: false } : r))
        return
      }

      const before = lastCommittedRef.current.get(id)
      const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'x-branch-id': String(branchId) },
        data: { countedQty: qty },
        silent: true
      })
      if (!res?.ok || !res?.item) {
        toast.error(res?.message || 'Kaydedilemedi')
        const rollback = String(Number(before ?? 0))
        setUiQtyById(prev2 => ({ ...(prev2 || {}), [id]: rollback }))
        setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, countedQty: Number(before ?? r.countedQty), saving: false } : r))
        return
      }
      const savedQty = Number(res.item.countedQty || 0)
      lastCommittedRef.current.set(id, savedQty)
      setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, countedQty: savedQty, saving: false, savedAt: Date.now() } : r))
      if (!editingIdsRef.current.has(id)) {
        setUiQtyById(prev2 => ({ ...(prev2 || {}), [id]: String(savedQty) }))
      }
      setLast(prevLast => (prevLast && String(prevLast.itemId) === id) ? { ...prevLast, countedQty: savedQty } : prevLast)
    }, 400))
  }

  const finish = async () => {
    if (!sessionId) return
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/finish`, { method: 'POST', headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.summary) {
      toast.error(res?.message || 'Özet alınamadı')
      setLoading(false)
      return
    }
    const s = res.summary
    setSummary(s)
    setSessionStatus(String(s?.session?.status || 'finished'))
    const items = Array.isArray(s?.items) ? s.items : []
    setRows(items.map(x => ({ itemId: String(x.itemId || ''), productId: String(x.productId || ''), barcode: String(x.barcode || ''), name: String(x.productName || ''), countedQty: Number(x.countedQty || 0), saving: false, savedAt: null })))
    for (const it of items) lastCommittedRef.current.set(String(it.itemId || ''), Number(it.countedQty || 0))
    setUiQtyById(prev => {
      const next = { ...(prev || {}) }
      for (const it of items) {
        const id = String(it.itemId || '')
        if (!id) continue
        if (editingIdsRef.current.has(id)) continue
        next[id] = String(Number(it.countedQty || 0))
      }
      return next
    })
    setLoading(false)
  }

  const apply = async () => {
    if (!sessionId) return
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/apply`, {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Uygulanamadı')
      setLoading(false)
      return
    }
    toast.success('Stoğa uygulandı')
    setSessionId('')
    setSessionStatus('')
    setSummary(null)
    setRows([])
    setLast(null)
    setBarcode('')
    setLoading(false)
    try { if (storageKey) localStorage.removeItem(storageKey) } catch {}
  }

  const extra = useMemo(() => Array.isArray(summary?.extra) ? summary.extra : [], [summary])
  const missing = useMemo(() => Array.isArray(summary?.missing) ? summary.missing : [], [summary])
  const same = useMemo(() => Array.isArray(summary?.same) ? summary.same : [], [summary])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Sayım</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!sessionId && <button className="btn btn--primary" type="button" onClick={start} disabled={!canUse || loading}>Sayım Başlat</button>}
            {!!sessionId && <button className="btn" type="button" onClick={finish} disabled={!canUse || loading}>Bitir</button>}
            {!!sessionId && <button className="btn btn--primary" type="button" onClick={apply} disabled={!canUse || loading || sessionStatus !== 'finished'}>Stoğa Uygula</button>}
          </div>
        </div>

        {!!sessionId && (
          <div className="stockCountScanRow" style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' }}>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod okut</div>
              <input
                className="input"
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const v = String(barcode || '').trim()
                  setBarcode('')
                  scan(v, qty)
                }}
                placeholder="Barkod"
                inputMode="numeric"
                disabled={!canUse || loading || sessionStatus !== 'open'}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sayılan</div>
              <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" disabled={!canUse || loading} />
            </label>
          </div>
        )}

        <ProductSearchBox
          branchId={branchId}
          disabled={!canUse || loading || !sessionId || sessionStatus !== 'open'}
          onSelect={(p) => {
            if (!sessionId || sessionStatus !== 'open') return
            scan('', 1, { productId: String(p?.id || '') })
          }}
        />

        {!canUse && <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div>}
        {!sessionId && canUse && <div style={{ color: 'var(--muted)' }}>Sayım başlatınca barkod okutabilirsin.</div>}

        {last && (
          <div className="card" style={{ padding: 12, background: '#f9fafb' }}>
            <div style={{ fontWeight: 800 }}>Son okunan</div>
            <div style={{ fontWeight: 700 }}>{last.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{last.barcode}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Mevcut Stok: {Number(last.stockQty || 0)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div style={{ fontWeight: 700 }}>Sayılan</div>
              <div style={{ position: 'relative', zIndex: 5 }}>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={uiQtyById[String(last.itemId || '')] ?? String(Number(last.countedQty || 0))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => {
                    const id = String(last.itemId || '')
                    if (!id) return
                    editingIdsRef.current.add(id)
                  }}
                  onBlur={() => {
                    const id = String(last.itemId || '')
                    if (!id) return
                    editingIdsRef.current.delete(id)
                    const v = String((uiQtyById || {})[id] ?? '').trim()
                    if (v !== '') updateRowCountedQty(id, v)
                  }}
                  onChange={(e) => updateRowCountedQty(last.itemId, e.target.value)}
                  disabled={!last.itemId || loading}
                  style={{ width: 120, height: 38, pointerEvents: 'auto' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div style={{ fontWeight: 700 }}>Fark</div>
              <div style={{ fontWeight: 900 }}>{Number(last.countedQty || 0) - Number(last.stockQty || 0)}</div>
            </div>
          </div>
        )}
      </div>

      {canViewHistory && (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>Geçmiş Sayımlar</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="input" value={String(historyRangeDays)} onChange={(e) => setHistoryRangeDays(Number(e.target.value))} style={{ height: 34 }} disabled={!canUse || historyLoading}>
                <option value={7}>Son 7 gün</option>
                <option value={30}>Son 30 gün</option>
                <option value={0}>Tümü</option>
              </select>
              <button className="btn btn--compact" type="button" onClick={loadHistory} disabled={!canUse || historyLoading}>Yenile</button>
            </div>
          </div>
          {!!historyError && <div style={{ color: '#b91c1c' }}>{historyError}</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {(historyItems || []).map(h => {
              const createdAt = h?.createdAt ? new Date(h.createdAt).toLocaleString('tr-TR') : '-'
              const who = h?.createdBy?.name ? String(h.createdBy.name) : '-'
              const lineCount = Number(h?.lineCount || 0)
              const diff = Number(h?.totalDiff || 0)
              const status = h?.status === 'completed' ? 'Tamamlandı' : (h?.status === 'open' ? 'Devam ediyor' : 'Hazır')
              return (
                <button key={h.id} type="button" className="btn btn--full btn--between" onClick={() => openDetail(h.id)} disabled={!canUse || historyLoading} style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'grid', textAlign: 'left' }}>
                    <span style={{ fontWeight: 800 }}>{createdAt}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {who} • Satır: {lineCount} • Durum: {status}</span>
                  </span>
                  <span style={{ fontWeight: 800, whiteSpace: 'nowrap', color: diff < 0 ? '#ef4444' : (diff > 0 ? '#16a34a' : 'var(--text)') }}>{diff > 0 ? `+${diff}` : diff}</span>
                </button>
              )
            })}
            {!historyLoading && historyItems.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
          </div>
        </div>
      )}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Sayım Detayı">
        <div style={{ display: 'grid', gap: 10 }}>
          {detailLoading && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
          {!!detailError && <div style={{ color: '#b91c1c' }}>{detailError}</div>}
          {detail?.count && (
            <div className="card" style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 800 }}>{detail.count.createdAt ? new Date(detail.count.createdAt).toLocaleString('tr-TR') : ''}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {detail.count.createdBy?.name || '-'} • Durum: {detail.count.status === 'completed' ? 'Tamamlandı' : (detail.count.status === 'open' ? 'Devam ediyor' : 'Hazır')}</div>
            </div>
          )}
          {(detail?.lines || []).map(l => (
            <div key={`${l.productId}_${l.barcode}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div className="breakAny" style={{ fontWeight: 800 }}>{l.name || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{l.barcode || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Sistem: {l.systemQty === null || l.systemQty === undefined ? '-' : Number(l.systemQty || 0)}
                  {' • '}
                  Sayılan: {l.countedQty === null || l.countedQty === undefined ? '-' : Number(l.countedQty || 0)}
                  {' • '}
                  Fark: {l.diff === null || l.diff === undefined ? '-' : Number(l.diff || 0)}
                </div>
              </div>
              {(() => {
                const d = l.diff === null || l.diff === undefined ? null : Number(l.diff)
                const ok = d !== null && Number.isFinite(d)
                const text = ok ? (d > 0 ? `+${d}` : String(d)) : '-'
                const color = !ok ? 'var(--muted)' : (d < 0 ? '#ef4444' : (d > 0 ? '#16a34a' : 'var(--text)'))
                return <div style={{ fontWeight: 800, whiteSpace: 'nowrap', color }}>{text}</div>
              })()}
            </div>
          ))}
          {!detailLoading && detail && (detail.lines || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </Modal>

      {!!sessionId && (
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Okunanlar</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map(it => (
              <div key={it.itemId || it.barcode} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.name || '-'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{it.barcode}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Mevcut Stok: {Number(it.stockQty || 0)} • Fark: {Number(it.countedQty || 0) - Number(it.stockQty || 0)}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{it.saving ? 'Kaydediliyor...' : (it.savedAt ? 'Kaydedildi' : '')}</div>
                </div>
                <div style={{ position: 'relative', zIndex: 5 }}>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    value={uiQtyById[String(it.itemId || '')] ?? String(Number(it.countedQty || 0))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => {
                      const id = String(it.itemId || '')
                      if (!id) return
                      editingIdsRef.current.add(id)
                    }}
                    onBlur={() => {
                      const id = String(it.itemId || '')
                      if (!id) return
                      editingIdsRef.current.delete(id)
                      const v = String((uiQtyById || {})[id] ?? '').trim()
                      if (v !== '') updateRowCountedQty(id, v)
                    }}
                    onChange={(e) => updateRowCountedQty(it.itemId, e.target.value)}
                    disabled={!it.itemId || loading}
                    style={{ width: 120, height: 38, pointerEvents: 'auto' }}
                  />
                </div>
              </div>
            ))}
            {rows.length === 0 && <div style={{ color: 'var(--muted)' }}>Henüz barkod okunmadı</div>}
          </div>
        </div>
      )}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'start' }}>
          <CountList title="Fazla" items={extra} />
          <CountList title="Eksik" items={missing} />
          <CountList title="Aynı" items={same} />
        </div>
      )}
    </div>
  )
}

function ProductSearchBox({ branchId, onSelect, disabled }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const abortRef = useRef(null)
  const lastKeyRef = useRef('')

  useEffect(() => {
    const term = String(q || '').trim()
    if (term.length < 2) {
      setItems([])
      setLoading(false)
      lastKeyRef.current = ''
      try { abortRef.current?.abort() } catch {}
      abortRef.current = null
      return
    }

    const key = `q:${term.toLowerCase()}`
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key

    try { abortRef.current?.abort() } catch {}
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    const t = setTimeout(() => {
      api(`/api/canteen/products/search?q=${encodeURIComponent(term)}&limit=20`, { silent: true, headers: { 'x-branch-id': String(branchId) }, signal: controller.signal })
        .then((res) => {
          setItems(Array.isArray(res?.items) ? res.items : [])
          setLoading(false)
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') setLoading(false)
        })
    }, 350)

    return () => {
      clearTimeout(t)
      try { controller.abort() } catch {}
    }
  }, [q, branchId])

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürün ara</div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün ara (isim ile)" disabled={disabled} />
      </label>
      {(loading || items.length > 0) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading && <div style={{ padding: 10, color: 'var(--muted)' }}>Aranıyor...</div>}
          {items.slice(0, 20).map(p => (
            <button
              key={p.id}
              type="button"
              className="btn btn--full btn--between"
              onClick={() => {
                setQ('')
                setItems([])
                onSelect?.(p)
              }}
              disabled={disabled}
              style={{ justifyContent: 'space-between' }}
            >
              <span style={{ display: 'grid', textAlign: 'left' }}>
                <span style={{ fontWeight: 800 }}>{p.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.barcode ? `Barkod: ${p.barcode}` : ''}{`  `}Stok: {Number(p.stockQty || 0)}</span>
              </span>
              <span style={{ color: 'var(--muted)' }}>{money(p.price)} ₺</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CountList({ title, items }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{list.length}</div>
      </div>
      {list.map(x => (
        <div key={x.productId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{x.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{x.barcode || '-'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Başlangıç: {Number(x.currentStockAtStart || 0)} • Sayılan: {Number(x.countedQty || 0)}</div>
          </div>
          <div style={{ fontWeight: 800 }}>{Number(x.diff || 0) > 0 ? `+${Number(x.diff || 0)}` : Number(x.diff || 0)}</div>
        </div>
      ))}
      {list.length === 0 && <div style={{ color: 'var(--muted)' }}>-</div>}
    </div>
  )
}
